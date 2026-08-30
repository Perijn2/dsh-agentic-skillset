/**
 * @module client-manifest.test
 * @author Perijn
 * Tests the package exports needed for Harness web-client discovery.
 *
 * @remarks
 * Includes:
 *   - client manifest tests: ensure the settings client is exported.
 *
 * Usage:
 *   node --test test/client-manifest.test.mjs
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/** Verify the Harness can resolve the client settings module. */
test('package exports the web settings client', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './client.js')
})

/** Verify the standard ships its version-aligned GitButler command reference. */
test('ships and routes agents to the bundled GitButler skill', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const standard = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8')

  assert.ok(manifest.files.includes('references/'))
  assert.match(standard, /references\/gitbutler\/SKILL\.md/)
  assert.match(standard, /How it works/)
  assert.match(standard, /After `git init` in a new repository/)
})
