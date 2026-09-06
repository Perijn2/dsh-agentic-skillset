/**
 * @module command-guard
 * @author Perijn
 * Converts Harness shell payloads into safe Git workflow decisions.
 *
 * @remarks
 * Includes:
 *   - guardToolPayload: produce a hook exit code and diagnostic.
 *
 * Usage:
 *   import { guardToolPayload } from './command-guard.mjs';
 *   guardToolPayload({ tool_input: { command: 'git status' } });
 */

import { classifyCommand } from './command-policy.mjs'

/** Split unquoted shell command boundaries without evaluating the command. */
function splitShellSegments(command) {
  const segments = []
  let segment = ''
  let quote = null
  let escaped = false

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]
    if (escaped) {
      segment += character
      escaped = false
      continue
    }
    if (quote !== null) {
      segment += character
      if (character === '\\' && quote === '"') escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      segment += character
      continue
    }
    if (character === ';' || character === '\n' || character === '|') {
      if (segment.trim()) segments.push(segment)
      segment = ''
      if (character === '|' && command[index + 1] === '|') index += 1
      continue
    }
    if (character === '&' && command[index + 1] === '&') {
      if (segment.trim()) segments.push(segment)
      segment = ''
      index += 1
      continue
    }
    segment += character
  }
  if (segment.trim()) segments.push(segment)
  return segments
}

/** Detect a Git executable only where a shell segment can begin a command. */
function hasGitExecutable(command) {
  return splitShellSegments(command).some((segment) => /^\s*git(?:\s|$)/.test(segment))
}

/** Detect multiple unquoted shell command segments. */
function isComposed(command) {
  return splitShellSegments(command).length > 1
}

/** Classify every Git command segment without treating safe inspection as mutation. */
function classifyGitSegments(command) {
  return splitShellSegments(command)
    .filter((segment) => /^\s*git(?:\s|$)/.test(segment))
    .map((segment) => ({
      command: segment.trim(),
      decision: classifyCommand(segment.trim().split(/\s+/)),
    }))
}

/** Convert a policy decision into the PreToolUse result shape. */
function asHookResult(decision, command) {
  if (decision.decision === 'allow') return { exitCode: 0, stderr: '' }
  return {
    exitCode: 2,
    stderr: [
      '[gitbutler-commit-standard] Command blocked.',
      `Blocked command: ${command}`,
      'Policy: GitButler-only mutations',
      `Reason: ${decision.reason}`,
      `How to proceed: ${decision.remediation}`,
    ].join('\n'),
  }
}

/** Validate a Harness shell command without executing it. */
export function guardToolPayload(payload) {
  const command = payload?.tool_input?.command ?? payload?.tool_input?.cmd
  if (typeof command !== 'string' || !hasGitExecutable(command)) return { exitCode: 0, stderr: '' }
  if (isComposed(command)) {
    const blockedSegment = classifyGitSegments(command).find(({ decision }) => decision.decision === 'block')
    if (!blockedSegment) return { exitCode: 0, stderr: '' }
    return asHookResult(blockedSegment.decision, blockedSegment.command)
  }
  return asHookResult(classifyCommand(command.trim().split(/\s+/)), command.trim())
}
