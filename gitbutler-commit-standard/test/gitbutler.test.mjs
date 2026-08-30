/**
 * @module gitbutler.test
 * @author Perijn
 * Tests GitButler CLI detection and confirmed installation.
 *
 * @remarks
 * Includes:
 *   - GitButler prerequisite tests.
 *
 * Usage:
 *   node --test test/gitbutler.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { detectBut, installBut } from '../src/gitbutler.mjs'

/** Verify a successful version check becomes availability metadata. */
test('detectBut reports a verified executable version', async () => {
  const result = await detectBut({ run: async () => ({ code: 0, stdout: 'but 1.0.0\n' }) })
  assert.deepEqual(result, { available: true, version: '1.0.0' })
})

/** Verify network installation is never implicit. */
test('installBut refuses network installation without confirmation', async () => {
  await assert.rejects(() => installBut({ confirm: false, platform: 'linux', run: async () => ({}) }))
})
