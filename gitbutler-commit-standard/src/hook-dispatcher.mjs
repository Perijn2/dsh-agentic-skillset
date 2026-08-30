/**
 * @module hook-dispatcher
 * @author Perijn
 * Sequences repository commit hooks and commitlint validation.
 *
 * @remarks
 * Includes:
 *   - dispatchCommitMsg: run chained validation for one message file.
 *
 * Usage:
 *   await dispatchCommitMsg(messagePath, { lint });
 */

import { lintMessage } from './commitlint-runner.mjs'

/** Run the native repository hook first, then lint the unchanged message. */
export async function dispatchCommitMsg(messagePath, {
  runRepositoryHook = async () => {},
  lint = (path) => lintMessage(path, { profile: 'conventional' }),
} = {}) {
  await runRepositoryHook(messagePath)
  await lint(messagePath)
}
