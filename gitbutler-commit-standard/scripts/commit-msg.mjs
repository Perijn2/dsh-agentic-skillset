/**
 * @module commit-msg
 * @author Perijn
 * Entrypoint used by the managed Git commit-msg dispatcher.
 *
 * @remarks
 * Includes:
 *   - commit message entrypoint: exits nonzero when commitlint rejects a message.
 *
 * Usage:
 *   node scripts/commit-msg.mjs .git/COMMIT_EDITMSG
 */

import { dispatchCommitMsg } from '../src/hook-dispatcher.mjs'

const messagePath = process.argv[2]
if (!messagePath) {
  process.stderr.write('[gitbutler-commit-standard] commit-msg requires a message path.\n')
  process.exit(1)
}

try {
  await dispatchCommitMsg(messagePath)
} catch (error) {
  process.stderr.write(`[gitbutler-commit-standard] ${error.message}\n`)
  process.exit(1)
}
