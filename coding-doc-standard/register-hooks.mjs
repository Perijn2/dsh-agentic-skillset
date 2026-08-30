/**
 * coding-doc-standard — cordis plugin.
 *
 * Wires the Claude Code hooks bridge (`@deepseek-ai/dsh-hooks-claude-code`) to
 * this package's doc-standard hook config, so that on EVERY `write`/`edit` tool
 * call a PreToolUse hook runs the coding-documentation standard checker; a
 * non-compliant file is BLOCKED (exit 2 -> model feedback) rather than allowed.
 *
 * Also registers a settings namespace (`coding-doc-standard`) with the harness
 * settings service, so the policy can be driven from Settings → Plugins. The
 * resolved section is written to `<pluginRoot>/config.json` on every commit;
 * the checker reads that file on each invocation.
 *
 * This module is the single registration point. It is mounted by the cordis
 * loader (see `scripts/install.mjs`), which inserts a row whose `name` is this
 * file's absolute path and whose `config` supplies `configPath`/`pluginRoot`.
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { join, resolve, dirname } from 'node:path'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'

/** Stable plugin id, referenced by the installed cordis row. */
export const name = 'coding-doc-standard'
// This wrapper delegates to hooks-claude-code, whose apply() accesses
// ctx.shell. Cordis evaluates injection on this mounted plugin, not on the
// delegated module, so the dependency must be declared here as well.
export const inject = ['shell']

// ---------------------------------------------------------------------------
// Defaults — mirror src/checker.py so JS and Python stay in sync.
// ---------------------------------------------------------------------------

const DEFAULT_INCLUDE_EXTENSIONS = [
  '.py', '.ts', '.js', '.mjs', '.cjs', '.rs', '.c', '.h',
  '.cpp', '.cc', '.hpp', '.cxx', '.hxx',
]

const DEFAULT_SKIP_SEGMENTS = [
  '.git', 'node_modules', 'vendor', 'target', 'dist', 'build', '__pycache__',
]

const DEFAULT_PLACEHOLDER_AUTHORS = [
  '', 'todo', 'tbd', 'fixme', 'unknown', 'n/a', 'none', 'agent', 'ai',
  'assistant', 'claude', 'copilot', 'you', 'name', 'your', 'placeholder',
]

const DEFAULT_MIN_FILE_SIZE = 50
const DEFAULT_TIMEOUT_MS = 10000

/** Settings-page language switches and the extensions enforced for each. */
const LANGUAGE_EXTENSIONS = {
  python: ['.py'],
  typescriptJavascript: ['.ts', '.js', '.mjs', '.cjs'],
  rust: ['.rs'],
  cCpp: ['.c', '.h', '.cpp', '.cc', '.hpp', '.cxx', '.hxx'],
}

/** Convert the settings-page language switches into checker includeExtensions. */
export function languageSettingsToExtensions(settings) {
  return Object.entries(LANGUAGE_EXTENSIONS).flatMap(([key, extensions]) =>
    settings?.[key] === true ? extensions : [])
}

function languageSettingsFromExtensions(extensions) {
  const selected = new Set(extensions.map((extension) => extension.toLowerCase()))
  return Object.fromEntries(
    Object.entries(LANGUAGE_EXTENSIONS).map(([key, languageExtensions]) => [
      key,
      languageExtensions.every((extension) => selected.has(extension)),
    ]),
  )
}

/** Build the default config object. */
function defaultConfig() {
  const config = {
    enabled: true,
    includeExtensions: [...DEFAULT_INCLUDE_EXTENSIONS],
    excludeExtensions: [],
    skipSegments: [...DEFAULT_SKIP_SEGMENTS],
    minFileSize: DEFAULT_MIN_FILE_SIZE,
    placeholderAuthors: [...DEFAULT_PLACEHOLDER_AUTHORS],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
  return { ...config, ...languageSettingsFromExtensions(config.includeExtensions) }
}

// ---------------------------------------------------------------------------
// Config file I/O (atomic write)
// ---------------------------------------------------------------------------

/** Read the current config.json, falling back to defaults when absent. */
function readConfigFile(pluginRoot) {
  const p = join(pluginRoot, 'config.json')
  if (!existsSync(p)) return defaultConfig()
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'))
    // Coerce to expected shape; missing keys get defaults.
    const config = {
      enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
      includeExtensions: Array.isArray(data.includeExtensions) ? data.includeExtensions : [...DEFAULT_INCLUDE_EXTENSIONS],
      excludeExtensions: Array.isArray(data.excludeExtensions) ? data.excludeExtensions : [],
      skipSegments: Array.isArray(data.skipSegments) ? data.skipSegments : [...DEFAULT_SKIP_SEGMENTS],
      minFileSize: typeof data.minFileSize === 'number' ? data.minFileSize : DEFAULT_MIN_FILE_SIZE,
      placeholderAuthors: Array.isArray(data.placeholderAuthors) ? data.placeholderAuthors : [...DEFAULT_PLACEHOLDER_AUTHORS],
      timeoutMs: typeof data.timeoutMs === 'number' ? data.timeoutMs : DEFAULT_TIMEOUT_MS,
    }
    return {
      ...config,
      ...languageSettingsFromExtensions(config.includeExtensions),
      ...Object.fromEntries(Object.keys(LANGUAGE_EXTENSIONS).map((key) => [
        key, typeof data[key] === 'boolean' ? data[key] : languageSettingsFromExtensions(config.includeExtensions)[key],
      ])),
    }
  } catch {
    return defaultConfig()
  }
}

/** Write `config` to `<pluginRoot>/config.json` atomically. */
function writeConfigFile(pluginRoot, config) {
  const p = join(pluginRoot, 'config.json')
  const tmp = join(pluginRoot, '.config.json.tmp')
  try {
    mkdirSync(pluginRoot, { recursive: true })
    writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8')
    renameSync(tmp, p)
  } catch (e) {
    // Best-effort: don't crash registration on a write failure.
    console.warn(`coding-doc-standard: warning — could not write config to ${p}: ${e.message}`)
  }
}

// ---------------------------------------------------------------------------
// Bridge resolution (unchanged from original)
// ---------------------------------------------------------------------------

/**
 * Resolve the Claude Code hooks bridge. Priority, in order:
 *   1. an explicit `DSH_HOOKS_CLAUDE_CODE_PATH` env var (wins when set),
 *   2. the bridge as a workspace package of the harness, resolved relative to
 *      the process cwd — i.e. the directory DSH is launched from, which is the
 *      harness checkout (`~/ai/deepseek-harness`).
 *
 * The candidate is an ABSOLUTE path, so the cordis loader's import override
 * handles it cleanly. Resolution is anchored to the launch cwd (not this
 * package's location), because the harness is a workspace the plugin never knows
 * how to reach by walking up from an external directory.
 */
async function resolveBridge() {
  const candidates = []
  if (process.env.DSH_HOOKS_CLAUDE_CODE_PATH) {
    candidates.push(pathToFileURL(process.env.DSH_HOOKS_CLAUDE_CODE_PATH))
  }
  candidates.push(
    pathToFileURL(join(process.cwd(), 'packages/hooks/hooks-claude-code/lib/index.js')),
  )

  let lastError
  for (const spec of candidates) {
    try {
      const mod = await import(spec)
      if (typeof mod.apply === 'function') {
        return { mod, name: mod.name ?? 'hooks-claude-code' }
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error(
    'coding-doc-standard: could not resolve the hooks-claude-code bridge from cwd=' +
      process.cwd(),
  )
}

// ---------------------------------------------------------------------------
// Settings resolution (optional — continue without it when unavailable)
// ---------------------------------------------------------------------------

/**
 * Resolve the @deepseek-ai/dsh-settings module. Priority, in order:
 *   1. an explicit `DSH_SETTINGS_PATH` env var (wins when set),
 *   2. the built lib entry of the settings package relative to process cwd
 *      (`<cwd>/packages/settings/settings/lib/index.js`).
 *
 * Returns `{ mod, installSettingsSection, settingsNamespace }` or null when
 * resolution fails — the plugin keeps working with defaults in that case.
 */
async function resolveSettings() {
  const candidates = []
  if (process.env.DSH_SETTINGS_PATH) {
    candidates.push(pathToFileURL(process.env.DSH_SETTINGS_PATH))
  }
  // Prefer the built lib entry when present; fall back to src/index.ts if not.
  const built = join(process.cwd(), 'packages/settings/settings/lib/index.js')
  const source = join(process.cwd(), 'packages/settings/settings/src/index.ts')
  if (existsSync(built)) {
    candidates.push(pathToFileURL(built))
  } else if (existsSync(source)) {
    candidates.push(pathToFileURL(source))
  }

  for (const spec of candidates) {
    try {
      const mod = await import(spec)
      if (typeof mod.installSettingsSection === 'function' && typeof mod.settingsNamespace === 'function') {
        const z = createRequire(spec)('@deepseek-ai/schemastery')
        if (typeof z.object !== 'function') continue
        return {
          mod,
          installSettingsSection: mod.installSettingsSection,
          settingsNamespace: mod.settingsNamespace,
          z,
        }
      }
    } catch {
      // Try next candidate.
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Cordis plugin body
// ---------------------------------------------------------------------------

/**
 * The cordis plugin body. Invoked by the loader with `(ctx, config)`.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the cordis context.
 * @param {object} [config] - bridge config passed through from the cordis row.
 */
export async function apply(ctx, config = {}) {
  const entryUrl = new URL(import.meta.url)
  const pluginRoot = resolve(fileURLToPath(entryUrl), config.pluginRoot ?? '.')
  const configPath = resolve(pluginRoot, config.configPath ?? 'hooks.json')

  // Resolve the bridge first — this is the hard dependency.
  const { mod, name: bridgeName } = await resolveBridge()
  const applyBridge = mod.apply

  ctx.logger.info(
    `coding-doc-standard: mounting ${bridgeName} (configPath=${configPath})`,
  )

  // Read/write the effective config file once at registration so the checker
  // always has a file to read even before the first settings commit.
  let currentConfig = readConfigFile(pluginRoot)
  writeConfigFile(pluginRoot, currentConfig)

  // Attempt to install the settings section. If the settings service is not
  // available (e.g. running outside the harness), log a warning and continue.
  const settings = await resolveSettings()
  if (settings) {
    const { installSettingsSection, settingsNamespace, z } = settings
    const ns = settingsNamespace('coding-doc-standard')

    // Keep this initial settings page deliberately small. The boolean field
    // names are user-facing labels in the harness settings UI; the persisted
    // includeExtensions remains the checker's stable runtime contract.
    const schema = z.object({
      enabled: z.boolean().default(true),
      python: z.boolean().default(currentConfig.python),
      typescriptJavascript: z.boolean().default(currentConfig.typescriptJavascript),
      rust: z.boolean().default(currentConfig.rust),
      cCpp: z.boolean().default(currentConfig.cCpp),
    })

    let source = () => currentConfig

    installSettingsSection(ctx, ns, schema, currentConfig, {
      setSource: (src) => { source = src },
      onChange: () => {
        // Write the resolved section back to config.json so the checker picks it
        // up on the next hook invocation, without a harness restart.
        const settingsValue = source()
        currentConfig = {
          ...currentConfig,
          enabled: settingsValue.enabled !== false,
          ...Object.fromEntries(Object.keys(LANGUAGE_EXTENSIONS).map((key) => [
            key, settingsValue[key] === true,
          ])),
        }
        currentConfig.includeExtensions = languageSettingsToExtensions(currentConfig)
        writeConfigFile(pluginRoot, currentConfig)
      },
    })

    ctx.logger.info('coding-doc-standard: settings section installed')
  } else {
    ctx.logger.warn('coding-doc-standard: settings service unavailable — running with default policy')
  }

  // Best-effort: sync hooks.json timeoutMs with config.json at boot.
  // The bridge reads hooks.json once at load; live changes require re-registration
  // which is out of scope. We rewrite hooks.json only when the values differ.
  try {
    const hooksRaw = readFileSync(configPath, 'utf8')
    const hooks = JSON.parse(hooksRaw)
    const hookTimeout = hooks.PreToolUse?.[0]?.hooks?.[0]?.timeout
    if (typeof hookTimeout === 'number' && hookTimeout !== currentConfig.timeoutMs / 1000) {
      hooks.PreToolUse[0].hooks[0].timeout = currentConfig.timeoutMs / 1000
      writeFileSync(configPath, JSON.stringify(hooks, null, 2) + '\n', 'utf8')
      ctx.logger.info(`coding-doc-standard: synced hooks.json timeout to ${currentConfig.timeoutMs}ms`)
    }
  } catch (e) {
    ctx.logger.warn(`coding-doc-standard: warning — could not sync hooks.json timeout: ${e.message}`)
  }

  // Delegate to the bridge. It reads `configPath` once at load and registers the
  // PreToolUse listeners. `pluginRoot` makes `${CLAUDE_PLUGIN_ROOT}` in the hook
  // command resolve to this package.
  applyBridge(ctx, {
    configPath,
    pluginRoot,
    ...config,
  })
}
