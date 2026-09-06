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

/** Make commitlint rejection output actionable without losing its diagnostic. */
function formatCommitlintFailure(diagnostic) {
  const reason = diagnostic.trim() || 'commitlint rejected the commit message.'
  return [
    'Commit message blocked by Conventional Commit policy.',
    `Reason: ${reason}`,
    'How to proceed: use <type>(optional-scope): <summary>, then a blank line and a description.',
    'Example: feat(parser): add token validation\n\nExplain the validation added by this change.',
    'Do not use --no-verify; correct the message and retry.',
  ].join('\n')
}

/**
 * Run commitlint and throw its diagnostics when it rejects the message.
 *
 * @param messagePath - Path to Git's commit-message file.
 * @param policy - Commit-message profile to validate.
 * @param run - Process runner for commitlint.
 * @returns Resolves after commitlint accepts the message.
 */
export async function lintMessage(messagePath, policy, run = runProcess) {
  if (policy.profile !== 'conventional') throw new Error(`Unsupported commitlint profile: ${policy.profile}`)
  const result = await run([
    process.execPath, commitlintCli, '--config', commitlintConfig, '--edit', messagePath,
  ])
  if (result.code !== 0) throw new Error(formatCommitlintFailure(result.stderr || result.stdout || ''))
}
