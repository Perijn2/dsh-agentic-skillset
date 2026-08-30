/**
 * @module command-policy.test
 * @author Perijn
 * Tests classification of Git inspection and mutation commands.
 *
 * @remarks
 * Includes:
 *   - command policy tests: protect the GitButler-only mutation boundary.
 *
 * Usage:
 *   node --test test/command-policy.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCommand } from '../src/command-policy.mjs'

/** Verify status remains available for ordinary inspection. */
test('allows a read-only git status request', () => {
  assert.equal(classifyCommand(['git', 'status']).decision, 'allow')
})

/** Verify repository bootstrap does not require GitButler. */
test('allows git init to bootstrap a repository before but setup', () => {
  assert.equal(classifyCommand(['git', 'init']).decision, 'allow')
})

/** Verify commits are routed to GitButler. */
test('blocks direct git commit with a GitButler replacement', () => {
  const result = classifyCommand(['git', 'commit', '-m', 'fix: repair'])
  assert.equal(result.decision, 'block')
  assert.match(result.remediation, /^but commit -b /)
})

/** Verify bypass flags are always rejected. */
test('blocks no-verify even on an inspection-shaped invocation', () => {
  assert.equal(classifyCommand(['git', 'status', '--no-verify']).decision, 'block')
})

/** Verify a mutation-prone family has an explicit safe form only. */
test('allows only git branch --show-current', () => {
  assert.equal(classifyCommand(['git', 'branch', '--show-current']).decision, 'allow')
  assert.equal(classifyCommand(['git', 'branch', 'feature']).decision, 'block')
})

/** Verify submodule management remains available when GitButler has no equivalent. */
test('allows git submodule add', () => {
  assert.equal(classifyCommand(['git', 'submodule', 'add', 'https://example.test/library.git', 'vendor/library']).decision, 'allow')
})

/** Verify Git metadata operations without a GitButler equivalent remain available. */
test('allows tag creation and mutable Git configuration', () => {
  assert.equal(classifyCommand(['git', 'tag', 'v1.0.0']).decision, 'allow')
  assert.equal(classifyCommand(['git', 'config', 'user.name', 'Perijn']).decision, 'allow')
})
