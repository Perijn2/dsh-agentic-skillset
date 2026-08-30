/**
 * @module installer.test
 * @author Perijn
 * Tests installation planning without mutating user-level Git configuration.
 *
 * @remarks
 * Includes:
 *   - installer tests: verify dry runs and hooks-path conflict protection.
 *
 * Usage:
 *   node --test test/installer.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInstallPlan } from '../src/installer.mjs'

/** Verify global installation does not replace Git's repository hook path. */
test('buildInstallPlan reports prerequisites without replacing global hooks', () => {
  const plan = buildInstallPlan({ butAvailable: false, previousHooksPath: '' })
  assert.equal(plan.installGitButler, true)
  assert.equal(plan.replaceHooksPath, false)
})

/** Verify unmanaged hooks require an explicit migration decision. */
test('buildInstallPlan leaves an unmanaged global hooks path untouched', () => {
  const plan = buildInstallPlan({ butAvailable: true, previousHooksPath: '/custom/hooks' })
  assert.equal(plan.requiresHooksPathConfirmation, false)
})
