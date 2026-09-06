/**
 * @module register-hooks.test
 * @author Perijn
 * Tests plugin registration metadata and settings normalization.
 *
 * @remarks
 * Includes:
 *   - registration tests: protect the shell injection contract.
 *
 * Usage:
 *   node --test test/register-hooks.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { inject, settingsToConfig } from '../register-hooks.mjs'

/** Verify the hook plugin declares its required Harness service. */
test('plugin declares shell injection required by the command guard', () => {
  assert.deepEqual(inject, ['shell'])
})

/** Verify settings preserve a disabled command guard. */
test('settings update writes a disabled command guard', () => {
  assert.equal(settingsToConfig({ enabled: true, commandGuard: false, commitlint: true }).commandGuard, false)
})
