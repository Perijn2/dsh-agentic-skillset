/**
 * @module install
 * @author Perijn
 * Installs the global Harness plugin without taking over Git hook configuration.
 *
 * @remarks
 * Includes:
 *   - installer entrypoint: performs only user-confirmed global mutations.
 *
 * Usage:
 *   node scripts/install.mjs --dry-run
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { detectBut, installBut } from '../src/gitbutler.mjs'
import { buildInstallPlan } from '../src/installer.mjs'
import { upsertPluginPatch } from '../src/cordis-patch.mjs'

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const confirmGitButler = args.has('--yes-install-gitbutler')
const dshHome = join(homedir(), '.dsh')
const managedHooksPath = join(dshHome, 'gitbutler-commit-standard', 'hooks')
const skillTarget = join(dshHome, 'skills', 'gitbutler-commit-standard', 'SKILL.md')
const packageLinks = [
  join(dshHome, 'node_modules', 'gitbutler-commit-standard'),
  join(dshHome, 'profiles', 'web', 'node_modules', 'gitbutler-commit-standard'),
]

function globalHooksPath() {
  try { return execFileSync('git', ['config', '--global', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim() } catch { return '' }
}

function showPlan(plan) {
  if (plan.installGitButler) console.log('GitButler CLI is missing; installation is required.')
  if (plan.removeLegacyHooksPath) console.log('Removing this package\'s legacy global core.hooksPath migration.')
  console.log('Git hooks remain repository-local and are installed with the repository hook installer.')
  console.log(`Harness config: ${process.env.DSH_CONFIG || join(dshHome, 'cordis.patch.yml')}`)
}

const but = await detectBut()
const plan = buildInstallPlan({ butAvailable: but.available, previousHooksPath: globalHooksPath(), managedHooksPath })
showPlan(plan)
if (dryRun) process.exit(0)
if (plan.installGitButler) await installBut({ confirm: confirmGitButler })

mkdirSync(dirname(skillTarget), { recursive: true })
copyFileSync(join(root, 'SKILL.md'), skillTarget)
cpSync(join(root, 'references'), join(dirname(skillTarget), 'references'), { recursive: true, force: true })
for (const link of packageLinks) {
  mkdirSync(dirname(link), { recursive: true })
  if (existsSync(link)) {
    if (!lstatSync(link).isSymbolicLink()) throw new Error(`Refusing to replace non-symlink package path ${link}`)
    unlinkSync(link)
  }
  symlinkSync(root, link, 'dir')
}
if (plan.removeLegacyHooksPath) execFileSync('git', ['config', '--global', '--unset', 'core.hooksPath'])

const configPath = process.env.DSH_CONFIG || join(dshHome, 'cordis.patch.yml')
mkdirSync(dirname(configPath), { recursive: true })
const current = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
writeFileSync(configPath, upsertPluginPatch(current, root))
console.log('Installed. Restart the DeepSeek Harness server to mount the plugin.')
console.log('For each repository: git init (if needed), but setup, then node ~/.dsh/node_modules/gitbutler-commit-standard/scripts/install-repository-hooks.mjs.')
