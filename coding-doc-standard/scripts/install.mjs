#!/usr/bin/env node
/**
 * @module install
 *
 * @author Perijn Huijser
 *
 * Install the coding-doc-standard package into the harness configuration.
 *
 * @remarks
 * Includes:
 *   - the hook plugin registration and machine-wide skill installation.
 *
 * Usage:
 *   node scripts/install.mjs [--config <cordis.patch.yml path>] [--dry-run]
 */
// Install coding-doc-standard into the harness cordis composition.
//
// Adds (or updates) a single cordis plugin row whose `name` is this package's
// `register-hooks.mjs`. When the harness boots, the cordis loader mounts that
// plugin, which wires the Claude Code hooks bridge to this package's
// `hooks.json` - so every write/edit tool call is checked against the standard.
//
// Usage:
//   node scripts/install.mjs [--config <cordis.patch.yml path>] [--dry-run]

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  symlinkSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { formatRows, parseRows, splitPatch } from './yaml-lite.mjs'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '')
const ENTRY = join(pkgRoot, 'register-hooks.mjs')
const HOOKS_JSON = join(pkgRoot, 'hooks.json')
const CHECKER = join(pkgRoot, 'src', 'checker.py')
const WRAPPER = join(pkgRoot, 'run-check.sh')
const SKILL_MD = join(pkgRoot, 'SKILL.md')
const SKILL_REFERENCES = [
  'c-cpp.md',
  'python.md',
  'typescript-javascript.md',
  'rust.md',
].map((name) => join(pkgRoot, name))
const PACKAGE_NAME = 'coding-doc-standard'
const BLACK_VERSION = '25.12.0'
const BLACK_TARGET = join(pkgRoot, '.tools', `black-${BLACK_VERSION}`)

function hasPinnedBlack() {
  try {
    execFileSync('python3', ['-c',
      `import black; assert black.__version__ == ${JSON.stringify(BLACK_VERSION)}`,
    ], {
      stdio: 'pipe',
      env: { ...process.env, PYTHONPATH: BLACK_TARGET },
    })
    return true
  } catch {
    return false
  }
}

function provisionPinnedBlack() {
  if (hasPinnedBlack()) {
    console.log(`coding-doc-standard: pinned Black ${BLACK_VERSION} is ready`)
    return
  }

  console.log(`coding-doc-standard: installing pinned Black ${BLACK_VERSION}`)
  mkdirSync(BLACK_TARGET, { recursive: true })
  execFileSync('python3', [
    '-m', 'pip', 'install', '--upgrade', '--target', BLACK_TARGET,
    `black==${BLACK_VERSION}`,
  ], { stdio: 'inherit' })
  if (!hasPinnedBlack()) {
    throw new Error(`coding-doc-standard: failed to provision Black ${BLACK_VERSION}`)
  }
}

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

function argValue(flag) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1]
  const inline = args.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(`${flag}=`.length) : undefined
}

const configPath = argValue('--config') ||
  process.env.DSH_CONFIG ||
  join(homedir(), '.dsh', 'cordis.patch.yml')

// --- validate package -------------------------------------------------------
const required = [ENTRY, HOOKS_JSON, CHECKER, WRAPPER, SKILL_MD, ...SKILL_REFERENCES]
const missing = required.filter((p) => !existsSync(p))
if (missing.length) {
  console.error(`coding-doc-standard: package is incomplete - missing:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}

console.log(`coding-doc-standard: installing into ${configPath}`)
console.log(`coding-doc-standard: plugin entry  ${ENTRY}`)
console.log(`coding-doc-standard: hook config  ${HOOKS_JSON}`)

// --- load cordis config -----------------------------------------------------
let docText
if (existsSync(configPath)) {
  try {
    docText = readFileSync(configPath, 'utf8')
  } catch (error) {
    console.error(`coding-doc-standard: failed to read ${configPath}: ${error.message}`)
    process.exit(1)
  }
} else {
  console.log(`coding-doc-standard: ${configPath} not found - will create a new patch layer`)
  docText = ''
}

// --- build the plugin row ---------------------------------------------------
const pluginRow = {
  id: 'coding-doc-standard',
  name: PACKAGE_NAME,
  config: {
    configPath: HOOKS_JSON,
    pluginRoot: pkgRoot,
  },
}

// --- transform --------------------------------------------------------------
const { header, insertOp } = splitPatch(docText)
let rows = insertOp ? parseRows(insertOp) : []

// Replace any existing hooks-claude-code row so the bridge registers exactly
// once (this package's plugin is now the single registration point), and make
// sure our plugin row is present (idempotent across re-runs).
rows = rows.filter(
  (r) => !(r?.name && String(r.name).includes('hooks-claude-code')),
)
const existingPluginRow = rows.findIndex((row) => row?.id === pluginRow.id)
if (existingPluginRow === -1) rows.push(pluginRow)
else rows[existingPluginRow] = pluginRow

const newInsert = formatRows(rows)

// Reassemble: header + insert op. Preserve a trailing newline; if the original
// had content after the insert block, keep it.
const trailing = docText.slice((header + (insertOp ?? '')).length)
let next
if (insertOp) {
  next = `${header.replace(/\n*$/, '')}\n${newInsert}${trailing}`
} else {
  next = `${header}${header.endsWith('\n') ? '' : '\n'}${newInsert}\n${trailing}`
}

// --- register the skill machine-wide -----------------------------------------
// The skill loader discovers SKILL.md at ~/.dsh/skills/<name>/SKILL.md (cwd-
// independent, so universal across workspaces/sessions). Install the package's
// SKILL.md there so a clean install carries the standard to every agent.
const skillName = 'coding-doc-standard'
const skillDir = join(homedir(), '.dsh', 'skills', skillName)
const skillTarget = join(skillDir, 'SKILL.md')
const skillReferenceTargets = SKILL_REFERENCES.map((source) => join(skillDir, source.split('/').at(-1)))
const packageLinks = [
  join(homedir(), '.dsh', 'node_modules', PACKAGE_NAME),
  join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', PACKAGE_NAME),
]

if (dryRun) {
  console.log('--- dry run: no files written. Resulting patch layer: ---')
  console.log(next)
  console.log(`coding-doc-standard: would install skill  ${skillTarget}`)
  for (const target of skillReferenceTargets) {
    console.log(`coding-doc-standard: would install reference ${target}`)
  }
  for (const link of packageLinks) console.log(`coding-doc-standard: would link package ${link} -> ${pkgRoot}`)
  console.log(`coding-doc-standard: would provision Black ${BLACK_VERSION}`)
  process.exit(0)
}

provisionPinnedBlack()

mkdirSync(skillDir, { recursive: true })
copyFileSync(SKILL_MD, skillTarget)
for (let index = 0; index < SKILL_REFERENCES.length; index += 1) {
  copyFileSync(SKILL_REFERENCES[index], skillReferenceTargets[index])
}
console.log(`coding-doc-standard: installed skill    ${skillTarget}`)
for (const target of skillReferenceTargets) {
  console.log(`coding-doc-standard: installed reference ${target}`)
}

for (const link of packageLinks) {
  mkdirSync(join(link, '..'), { recursive: true })
  if (existsSync(link)) {
    if (!lstatSync(link).isSymbolicLink()) {
      throw new Error(`coding-doc-standard: refusing to replace non-symlink package path ${link}`)
    }
    unlinkSync(link)
  }
  symlinkSync(pkgRoot, link, 'dir')
  console.log(`coding-doc-standard: linked package    ${link}`)
}

writeFileSync(configPath, next)
console.log(`coding-doc-standard: wrote ${configPath}`)

console.log(
  '\ncoding-doc-standard: next step - RESTART the harness server so the plugin mounts.',
)
console.log('  (stop the running server and relaunch; config is read at boot)')
