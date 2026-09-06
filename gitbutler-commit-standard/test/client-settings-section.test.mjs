/**
 * @author Perijn
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const clientPath = new URL('../client.js', import.meta.url)

test('registers a dedicated Settings sidebar section instead of a plugin card', async () => {
  const client = await readFile(clientPath, 'utf8')

  assert.match(client, /settings\.section/)
  assert.doesNotMatch(client, /settings\.plugin\.item/)
})

test('uses the Better Sidebar grouped settings-row and switch pattern', async () => {
  const client = await readFile(clientPath, 'utf8')

  assert.match(client, /gcs-settings-group/)
  assert.match(client, /gcs-settings-row/)
  assert.match(client, /gcs-switch-input/)
  assert.match(client, /--dsw-alias-button-primary-fill/)
})

test('introduces the standard before its enforcement controls', async () => {
  const client = await readFile(clientPath, 'utf8')

  assert.match(client, /gcs-settings-header/)
  assert.match(client, /GitButler Commit Standard/)
  assert.match(client, /routes Git mutations through the but CLI/)
})

test('marks only its Settings navigation item for a custom icon and cleans it up', async () => {
  const client = await readFile(clientPath, 'utf8')

  assert.match(client, /data-gitbutler-commit-standard-settings-nav/)
  assert.match(client, /removeAttribute\(NAV_MARKER\)/)
  assert.match(client, /\[data-gitbutler-commit-standard-settings-nav\]/)
})
