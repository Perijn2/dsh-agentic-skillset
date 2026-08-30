/**
 * @module gitbutler-commit-standard
 * @author Perijn
 * Registers GitButler command enforcement and policy settings with Cordis.
 *
 * @remarks
 * Includes:
 *   - apply: mount the Claude Code hooks bridge and settings namespace.
 *   - settingsToConfig: normalize values emitted by the settings page.
 *
 * Usage:
 *   Cordis loads this module from the installed plugin row.
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { readConfig, writeConfig } from './src/config.mjs'

/** Stable Cordis plugin identifier. */
export const name = 'gitbutler-commit-standard'

/** Services required by the delegated hooks bridge. */
export const inject = ['shell']

/** Normalize settings-page values into persisted policy configuration. */
export function settingsToConfig(value = {}) {
  return {
    enabled: value.enabled !== false,
    commandGuard: value.commandGuard !== false,
    commitlint: value.commitlint !== false,
    profile: 'conventional',
    repositoryProfileMode: ['disabled', 'approved-json', 'required-approved-json'].includes(value.repositoryProfileMode)
      ? value.repositoryProfileMode : 'disabled',
    repositoryExclusions: Array.isArray(value.repositoryExclusions)
      ? value.repositoryExclusions.filter((path) => typeof path === 'string' && path.startsWith('/')) : [],
  }
}

/** Resolve the installed Harness hook bridge from its documented workspace path. */
async function resolveBridge() {
  if (process.env.DSH_HOOKS_CLAUDE_CODE_PATH) return import(pathToFileURL(process.env.DSH_HOOKS_CLAUDE_CODE_PATH))
  return import(pathToFileURL(join(process.cwd(), 'packages/hooks/hooks-claude-code/lib/index.js')))
}

/** Resolve the optional Harness settings service and its schema helper. */
async function resolveSettings() {
  const candidates = []
  if (process.env.DSH_SETTINGS_PATH) candidates.push(pathToFileURL(process.env.DSH_SETTINGS_PATH))
  const built = join(process.cwd(), 'packages/settings/settings/lib/index.js')
  const source = join(process.cwd(), 'packages/settings/settings/src/index.ts')
  if (existsSync(built)) candidates.push(pathToFileURL(built))
  else if (existsSync(source)) candidates.push(pathToFileURL(source))
  for (const spec of candidates) {
    try {
      const mod = await import(spec)
      if (typeof mod.installSettingsSection !== 'function' || typeof mod.settingsNamespace !== 'function') continue
      const z = createRequire(spec)('@deepseek-ai/schemastery')
      if (typeof z.object === 'function') return { ...mod, z }
    } catch {
      // Try the next supported settings location.
    }
  }
  return null
}

/** Mount the command guard and persist settings changes atomically. */
export async function apply(ctx, config = {}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), config.pluginRoot ?? '.')
  const configPath = join(root, 'config.json')
  let current = await readConfig(configPath)
  await writeConfig(configPath, current)
  const bridge = await resolveBridge()
  if (typeof bridge.apply !== 'function') throw new Error('GitButler commit standard could not load the Harness hooks bridge.')
  bridge.apply(ctx, { configPath: join(root, 'hooks.json'), pluginRoot: root, ...config })
  const settings = await resolveSettings()
  if (!settings) {
    ctx.logger?.warn('gitbutler-commit-standard: settings service unavailable')
    return
  }
  const schema = settings.z.object({
    enabled: settings.z.boolean().default(current.enabled),
    commandGuard: settings.z.boolean().default(current.commandGuard),
    commitlint: settings.z.boolean().default(current.commitlint),
  })
  let source = () => current
  settings.installSettingsSection(ctx, settings.settingsNamespace('gitbutler-commit-standard'), schema, current, {
    setSource: (next) => { source = next },
    onChange: () => {
      current = settingsToConfig(source())
      void writeConfig(configPath, current)
    },
  })
}
