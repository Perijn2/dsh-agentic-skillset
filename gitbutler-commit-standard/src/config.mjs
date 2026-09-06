/**
 * @module config
 * @author Perijn
 * Reads and atomically persists the global GitButler commit-standard policy.
 *
 * @remarks
 * Includes:
 *   - DEFAULT_CONFIG: immutable default policy.
 *   - readConfig: load a normalized policy from JSON.
 *   - writeConfig: atomically store a normalized policy.
 *
 * Usage:
 *   import { readConfig } from './config.mjs';
 *   const policy = await readConfig('/path/to/config.json');
 */

import { readFile, rename, writeFile } from 'node:fs/promises'

/** Default machine-wide policy for the standard. */
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  commandGuard: true,
  commitlint: true,
  profile: 'conventional',
  repositoryProfileMode: 'disabled',
  repositoryExclusions: [],
})

/** Normalize untrusted JSON into the supported policy shape. */
export function normalizeConfig(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_CONFIG.enabled,
    commandGuard: typeof source.commandGuard === 'boolean' ? source.commandGuard : DEFAULT_CONFIG.commandGuard,
    commitlint: typeof source.commitlint === 'boolean' ? source.commitlint : DEFAULT_CONFIG.commitlint,
    profile: source.profile === 'conventional' ? source.profile : DEFAULT_CONFIG.profile,
    repositoryProfileMode: ['disabled', 'approved-json', 'required-approved-json'].includes(source.repositoryProfileMode)
      ? source.repositoryProfileMode : DEFAULT_CONFIG.repositoryProfileMode,
    repositoryExclusions: Array.isArray(source.repositoryExclusions)
      ? source.repositoryExclusions.filter((item) => typeof item === 'string' && item.startsWith('/')) : [],
  }
}

/** Load a policy file, using defaults when it is absent or invalid. */
export async function readConfig(path) {
  try {
    return normalizeConfig(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return normalizeConfig(DEFAULT_CONFIG)
  }
}

/** Atomically write a normalized policy file. */
export async function writeConfig(path, config) {
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, 'utf8')
  await rename(temporaryPath, path)
}
