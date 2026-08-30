/**
 * @module commitlint-runner
 * @author Perijn
 * Runs commitlint against Git's exact commit-message file.
 *
 * @remarks
 * Includes:
 *   - lintMessage: validate a message with the conventional profile.
 *
 * Usage:
 *   await lintMessage(messagePath, { profile: 'conventional' });
 */

import { runProcess } from './gitbutler.mjs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const commitlintCli = require.resolve('@commitlint/cli/cli.js')
const commitlintConfig = fileURLToPath(new URL('../commitlint.config.cjs', import.meta.url))

/** Run commitlint and throw its diagnostics when it rejects the message. */
export async function lintMessage(messagePath, policy, run = runProcess) {
  if (policy.profile !== 'conventional') throw new Error(`Unsupported commitlint profile: ${policy.profile}`)
  const result = await run([
    process.execPath, commitlintCli, '--config', commitlintConfig, '--edit', messagePath,
  ])
  if (result.code !== 0) throw new Error(result.stderr || 'commitlint rejected the commit message.')
}
