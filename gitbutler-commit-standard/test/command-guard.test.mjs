/**
 * @module command-guard.test
 * @author Perijn
 * Tests Harness payload handling for Git command enforcement.
 *
 * @remarks
 * Includes:
 *   - command guard tests: verify simple inspection and composed mutation behavior.
 *
 * Usage:
 *   node --test test/command-guard.test.mjs
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { guardToolPayload } from '../src/command-guard.mjs'

/** Verify composed shell commands fail closed when Git is present. */
test('blocks a shell-composed Git mutation', () => {
  const result = guardToolPayload({ tool_input: { command: 'git status && git commit -m "fix: x"' } })
  assert.equal(result.exitCode, 2)
})

/** Verify repository discovery can be composed with other safe inspection. */
test('allows composed read-only git rev-parse inspection', () => {
  const result = guardToolPayload({ tool_input: { command: 'git rev-parse --git-path hooks && git rev-parse --git-dir' } })
  assert.equal(result.exitCode, 0)
})

/** Verify quoted search text does not masquerade as a Git executable. */
test('allows a composed curl request whose JSON payload mentions git', () => {
  const result = guardToolPayload({
    tool_input: { command: `SID=$(cat /tmp/mcp_sid); curl -s -X POST https://search.example/mcp -d '{"query":"GitButler CLI git hooks commit"}'` },
  })
  assert.equal(result.exitCode, 0)
})

/** Verify heredoc content is not treated as a command invocation. */
test('allows a heredoc payload that mentions git commit', () => {
  const result = guardToolPayload({
    tool_input: { command: "cat > /tmp/query.json <<'EOF'\n{\"query\":\"GitButler but commit run git hooks\"}\nEOF\necho written" },
  })
  assert.equal(result.exitCode, 0)
})

/** Verify a direct inspection command is allowed. */
test('allows a direct read-only git log invocation', () => {
  const result = guardToolPayload({ tool_input: { command: 'git log --oneline' } })
  assert.equal(result.exitCode, 0)
})

/** Verify direct Git mutation output offers a GitButler remedy. */
test('blocks direct git commit with remediation', () => {
  const command = 'git commit -m "fix: x"'
  const result = guardToolPayload({ tool_input: { command } })
  assert.equal(result.exitCode, 2)
  assert.match(result.stderr, /Blocked command: git commit -m "fix: x"/)
  assert.match(result.stderr, /Policy: GitButler-only mutations/)
  assert.match(result.stderr, /Reason: Raw git commit is not permitted/)
  assert.match(result.stderr, /How to proceed: but commit/)
  assert.match(result.stderr, /but commit -b/)
})
