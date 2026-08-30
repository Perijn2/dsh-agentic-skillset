/**
 * @module hook-dispatcher.test
 * @author Perijn
 * Tests sequencing of an existing hook and commitlint validation.
 *
 * @remarks
 * Includes:
 *   - hook dispatcher tests.
 *
 * Usage:
 *   node --test test/hook-dispatcher.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchCommitMsg } from '../src/hook-dispatcher.mjs'

/** Verify existing repository hooks run before commitlint. */
test('dispatcher runs repository hook before commitlint', async () => {
  const events = []
  await dispatchCommitMsg('/tmp/MSG', {
    runRepositoryHook: async () => events.push('hook'),
    lint: async () => events.push('lint'),
  })
  assert.deepEqual(events, ['hook', 'lint'])
})
