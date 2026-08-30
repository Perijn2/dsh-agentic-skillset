/**
 * @module commitlint-runner.test
 * @author Perijn
 * Tests commit-message validation command construction.
 *
 * @remarks
 * Includes:
 *   - commitlint runner tests.
 *
 * Usage:
 *   node --test test/commitlint-runner.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { lintMessage } from '../src/commitlint-runner.mjs'

/** Verify conventional linting uses the exact Git message path. */
test('lintMessage passes the message path to conventional commitlint', async () => {
  const calls = []
  await lintMessage('/tmp/MSG', { profile: 'conventional' }, async (argv) => {
    calls.push(argv)
    return { code: 0, stderr: '' }
  })
  assert.deepEqual(calls[0].slice(-2), ['--edit', '/tmp/MSG'])
})

/** Verify global hooks execute the package-local commitlint binary. */
test('lintMessage resolves commitlint from this installed package', async () => {
  const calls = []
  await lintMessage('/tmp/MSG', { profile: 'conventional' }, async (argv) => {
    calls.push(argv)
    return { code: 0, stderr: '' }
  })
  assert.equal(calls[0][0], process.execPath)
  assert.match(calls[0][1], /node_modules\/@commitlint\/cli\/cli\.js$/)
  assert.equal(calls[0][2], '--config')
  assert.match(calls[0][3], /commitlint\.config\.cjs$/)
})

/** Verify a rejected message is surfaced to Git. */
test('lintMessage throws commitlint diagnostics on failure', async () => {
  await assert.rejects(
    () => lintMessage('/tmp/MSG', { profile: 'conventional' }, async () => ({ code: 1, stderr: 'subject may not be empty' })),
    (error) => {
      assert.match(error.message, /Commit message blocked by Conventional Commit policy\./)
      assert.match(error.message, /Reason: subject may not be empty/)
      assert.match(error.message, /How to proceed: use <type>\(optional-scope\): <description>/)
      assert.match(error.message, /Do not use --no-verify/)
      return true
    },
  )
})
