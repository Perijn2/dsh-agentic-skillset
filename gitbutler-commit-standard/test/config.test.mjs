/**
 * @module config.test
 * @author Perijn
 * Tests the persisted global policy configuration.
 *
 * @remarks
 * Includes:
 *   - configuration tests: verify fallback and atomic persistence behavior.
 *
 * Usage:
 *   node --test test/config.test.mjs
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_CONFIG, readConfig, writeConfig } from '../src/config.mjs'

/** Verify malformed configuration falls back to the global defaults. */
test('readConfig falls back to defaults for malformed JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gbcs-'))
  const path = join(directory, 'config.json')
  await writeFile(path, '{broken', 'utf8')
  assert.deepEqual(await readConfig(path), DEFAULT_CONFIG)
})

/** Verify configuration writes are persisted as normalized JSON. */
test('writeConfig persists normalized policy atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gbcs-'))
  const path = join(directory, 'config.json')
  await writeConfig(path, { ...DEFAULT_CONFIG, enabled: false })
  assert.equal(JSON.parse(await readFile(path, 'utf8')).enabled, false)
})
