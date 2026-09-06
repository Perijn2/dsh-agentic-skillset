/**
 * @module cordis-patch.test
 * @author Perijn
 * Tests creation of a Cordis insert operation for this plugin.
 *
 * @remarks
 * Includes:
 *   - Cordis patch tests: ensure the plugin is inserted rather than patched.
 *
 * Usage:
 *   node --test test/cordis-patch.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { upsertPluginPatch } from '../src/cordis-patch.mjs'

/** Verify the plugin is serialized inside the top-level insert operation. */
test('upsertPluginPatch inserts the GitButler plugin into a Cordis patch', () => {
  const patch = upsertPluginPatch('- insert:\n    - id: coding-doc-standard\n      name: coding-doc-standard\n')
  assert.match(patch, /- insert:\n/)
  assert.match(patch, /    - id: gitbutler-commit-standard\n      name: gitbutler-commit-standard/)
})
