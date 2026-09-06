# GitButler Commit Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a machine-wide DeepSeek Harness plugin that requires GitButler for agent-driven Git mutations and validates commit messages with commitlint.

**Architecture:** A PreToolUse shell-command guard classifies Git invocations and fails closed on mutations or ambiguous shell composition. A managed global `commit-msg` dispatcher chains a repository hook and runs a package-managed commitlint conventional profile. The Cordis plugin persists the settings UI configuration atomically.

**Tech Stack:** Node.js 18+ ESM, Bash, Git hooks, GitButler `but` CLI, `@commitlint/cli`, `@commitlint/config-conventional`, Node built-in test runner.

**Spec:** `gitbutler-commit-standard/docs/superpowers/specs/2026-08-28-gitbutler-commit-standard-design.md`

## Global Constraints

- The package applies globally by default; repository exclusions must be explicit absolute paths.
- Permit only classified, read-only `git` commands; block Git mutations and every `--no-verify` invocation through the Harness.
- Never execute a mutation from the guard and never silently allow a parser or hook failure.
- Require a verified `but` executable before enabling enforcement; installation requires user confirmation.
- Use `@commitlint/config-conventional` as the default profile.
- Do not auto-load executable JavaScript or TypeScript commitlint configuration from repositories.
- Follow `coding-doc-standard/SKILL.md` for all JavaScript and Bash documentation.
- Tests must use temporary directories and fake executables; they must not modify a developer's global Git configuration.

---

### Task 1: Package foundation and policy configuration

**Files:**
- Create: `gitbutler-commit-standard/package.json`
- Create: `gitbutler-commit-standard/config.json`
- Create: `gitbutler-commit-standard/SKILL.md`
- Create: `gitbutler-commit-standard/README.md`
- Create: `gitbutler-commit-standard/src/config.mjs`
- Create: `gitbutler-commit-standard/test/config.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_CONFIG`, `readConfig(path)`, and `writeConfig(path, config)` from `src/config.mjs`.
- Produces: the complete package manifest and machine-readable default policy used by every later task.

- [ ] **Step 1: Write the failing configuration tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, readConfig, writeConfig } from '../src/config.mjs'

test('readConfig falls back to defaults for malformed JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gbcs-'))
  const path = join(dir, 'config.json')
  await writeFile(path, '{broken', 'utf8')
  assert.deepEqual(await readConfig(path), DEFAULT_CONFIG)
})

test('writeConfig persists normalized policy atomically', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gbcs-'))
  const path = join(dir, 'config.json')
  await writeConfig(path, { ...DEFAULT_CONFIG, enabled: false })
  assert.equal(JSON.parse(await readFile(path, 'utf8')).enabled, false)
})
```

- [ ] **Step 2: Run the configuration test to verify it fails**

Run: `node --test test/config.test.mjs`

Expected: FAIL because `src/config.mjs` does not exist.

- [ ] **Step 3: Implement the manifest, documented defaults, and atomic config module**

```js
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  commandGuard: true,
  commitlint: true,
  profile: 'conventional',
  repositoryProfileMode: 'disabled',
  repositoryExclusions: [],
})

export async function readConfig(path) { /* parse and normalize JSON, else defaults */ }
export async function writeConfig(path, config) { /* write temp JSON then rename */ }
```

Create an ESM package manifest with Node 18+ support, runtime dependencies on
`@commitlint/cli` and `@commitlint/config-conventional`, and `npm test` mapped
to `node --test`. Document every public module with the required file header
and add the approved workflow to `SKILL.md` and `README.md`.

- [ ] **Step 4: Run the configuration test to verify it passes**

Run: `node --test test/config.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the foundation**

Run: `but commit -b gitbutler-commit-standard -m "feat: scaffold GitButler commit standard"`

Expected: a Conventional Commit on the GitButler branch.

### Task 2: Git command classifier and remediation policy

**Files:**
- Create: `gitbutler-commit-standard/src/command-policy.mjs`
- Create: `gitbutler-commit-standard/test/command-policy.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_CONFIG` from `src/config.mjs`.
- Produces: `classifyCommand(argv, config)` returning `{ decision: 'allow' | 'block', reason, remediation? }`.

- [ ] **Step 1: Write failing classifier tests**

```js
test('allows a read-only Git status request', () => {
  assert.equal(classifyCommand(['git', 'status']).decision, 'allow')
})

test('blocks direct git commit with its GitButler replacement', () => {
  assert.deepEqual(classifyCommand(['git', 'commit', '-m', 'fix: repair']).remediation,
    'but commit -b <branch> -m "fix: repair"')
})

test('blocks no-verify even in an inspection-shaped invocation', () => {
  assert.equal(classifyCommand(['git', 'status', '--no-verify']).decision, 'block')
})
```

- [ ] **Step 2: Run the classifier tests to verify they fail**

Run: `node --test test/command-policy.test.mjs`

Expected: FAIL because `classifyCommand` is not exported.

- [ ] **Step 3: Implement explicit classification tables**

```js
export function classifyCommand(argv, config = DEFAULT_CONFIG) {
  if (argv[0] !== 'git') return { decision: 'allow', reason: 'not-git' }
  if (argv.includes('--no-verify')) return block('Never bypass commit validation.')
  // Match only documented read-only Git forms; map known mutations to but.
}
```

Include read-only argument validation for `branch`, `config`, and `remote`;
never allow a family merely because its first subcommand can be read-only.
Map all mutation families named in the design to clear GitButler remediations.

- [ ] **Step 4: Run the classifier tests to verify they pass**

Run: `node --test test/command-policy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the command policy**

Run: `but commit -b gitbutler-commit-standard -m "feat: classify Git mutations for GitButler"`

Expected: a Conventional Commit on the GitButler branch.

### Task 3: Fail-closed shell request guard and Harness hook adapter

**Files:**
- Create: `gitbutler-commit-standard/src/command-guard.mjs`
- Create: `gitbutler-commit-standard/hooks.json`
- Create: `gitbutler-commit-standard/run-command-guard.sh`
- Create: `gitbutler-commit-standard/test/command-guard.test.mjs`

**Interfaces:**
- Consumes: `classifyCommand(argv, config)` from `src/command-policy.mjs` and `readConfig(path)` from `src/config.mjs`.
- Produces: `guardToolPayload(payload, config)` returning `{ exitCode, stderr }`; exit code `2` blocks a Harness request.

- [ ] **Step 1: Write failing guard tests**

```js
test('blocks a shell-composed Git mutation', () => {
  const result = guardToolPayload({ tool_input: { command: 'git status && git commit -m "fix: x"' } })
  assert.equal(result.exitCode, 2)
})

test('allows a direct read-only git log invocation', () => {
  const result = guardToolPayload({ tool_input: { command: 'git log --oneline' } })
  assert.equal(result.exitCode, 0)
})
```

- [ ] **Step 2: Run the guard tests to verify they fail**

Run: `node --test test/command-guard.test.mjs`

Expected: FAIL because the guard module does not exist.

- [ ] **Step 3: Implement conservative tokenization and the wrapper**

```js
export function guardToolPayload(payload, config = DEFAULT_CONFIG) {
  const command = payload?.tool_input?.command
  if (typeof command !== 'string') return { exitCode: 0, stderr: '' }
  if (containsShellOperatorOrSubstitution(command) && containsGit(command)) return blockedSimpleButMessage()
  return resultFrom(classifyCommand(parseDirectCommand(command), config))
}
```

Configure the hook bridge for the Harness shell/terminal tool matcher. The Bash
wrapper reads JSON from stdin, invokes the module, forwards diagnostics to
stderr, and returns `0` or `2`; malformed Git-bearing input returns `2`.

- [ ] **Step 4: Run the guard tests to verify they pass**

Run: `node --test test/command-guard.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the guard**

Run: `but commit -b gitbutler-commit-standard -m "feat: block raw Git mutations in the harness"`

Expected: a Conventional Commit on the GitButler branch.

### Task 4: GitButler CLI prerequisite service

**Files:**
- Create: `gitbutler-commit-standard/src/gitbutler.mjs`
- Create: `gitbutler-commit-standard/scripts/install-gitbutler.mjs`
- Create: `gitbutler-commit-standard/test/gitbutler.test.mjs`

**Interfaces:**
- Produces: `detectBut(env)`, `requireBut(env)`, and `installBut({ confirm, platform, run })`.
- Consumes: command guard configuration to disable mutation enforcement until `but` is verified.

- [ ] **Step 1: Write failing prerequisite tests**

```js
test('detectBut reports a verified executable version', async () => {
  const result = await detectBut({ run: async () => ({ code: 0, stdout: 'but 1.0.0\n' }) })
  assert.deepEqual(result, { available: true, version: '1.0.0' })
})

test('installBut refuses network installation without confirmation', async () => {
  await assert.rejects(() => installBut({ confirm: false, platform: 'linux', run: async () => ({}) }))
})
```

- [ ] **Step 2: Run the prerequisite tests to verify they fail**

Run: `node --test test/gitbutler.test.mjs`

Expected: FAIL because the prerequisite service does not exist.

- [ ] **Step 3: Implement detection, confirmed installation, and verification**

```js
export async function installBut({ confirm, platform, run }) {
  if (!confirm) throw new Error('GitButler installation requires confirmation.')
  if (!['darwin', 'linux'].includes(platform)) throw new Error('Install GitButler manually on this platform.')
  await run(['sh', '-c', 'curl -fsSL https://gitbutler.com/install.sh | sh'])
  return requireBut({ run })
}
```

Keep this operation only in the explicit installer/repair command, never in a
runtime hook. Verify `but --version` after the installer exits.

- [ ] **Step 4: Run the prerequisite tests to verify they pass**

Run: `node --test test/gitbutler.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the prerequisite service**

Run: `but commit -b gitbutler-commit-standard -m "feat: verify GitButler CLI prerequisite"`

Expected: a Conventional Commit on the GitButler branch.

### Task 5: Commitlint runner and managed hook dispatcher

**Files:**
- Create: `gitbutler-commit-standard/src/commitlint-runner.mjs`
- Create: `gitbutler-commit-standard/src/hook-dispatcher.mjs`
- Create: `gitbutler-commit-standard/hooks/commit-msg`
- Create: `gitbutler-commit-standard/test/commitlint-runner.test.mjs`
- Create: `gitbutler-commit-standard/test/hook-dispatcher.test.mjs`

**Interfaces:**
- Produces: `lintMessage(messagePath, policy, run)` and `dispatchCommitMsg(messagePath, context)`.
- Consumes: policy from `src/config.mjs`; default profile is `conventional`.

- [ ] **Step 1: Write failing lint and chaining tests**

```js
test('lintMessage passes the message path to conventional commitlint', async () => {
  const calls = []
  await lintMessage('/tmp/MSG', { profile: 'conventional' }, async (argv) => { calls.push(argv); return { code: 0 } })
  assert.deepEqual(calls[0].slice(-2), ['--edit', '/tmp/MSG'])
})

test('dispatcher runs repository hook before commitlint', async () => {
  const events = []
  await dispatchCommitMsg('/tmp/MSG', { runRepositoryHook: async () => events.push('hook'), lint: async () => events.push('lint') })
  assert.deepEqual(events, ['hook', 'lint'])
})
```

- [ ] **Step 2: Run the commit-message tests to verify they fail**

Run: `node --test test/commitlint-runner.test.mjs test/hook-dispatcher.test.mjs`

Expected: FAIL because runner and dispatcher modules do not exist.

- [ ] **Step 3: Implement fixed-profile linting and safe chaining**

```js
export async function lintMessage(messagePath, policy, run) {
  const args = ['commitlint', '--edit', messagePath, '--extends', '@commitlint/config-conventional']
  const result = await run(args)
  if (result.code !== 0) throw new Error(result.stderr || 'commitlint rejected the commit message')
}
```

Make `hooks/commit-msg` an executable shim that calls the dispatcher with
`$1`. Detect the repository-native hook from `$GIT_DIR/hooks/commit-msg`, skip
the dispatcher path itself, propagate its status, then run commitlint.

- [ ] **Step 4: Run the commit-message tests to verify they pass**

Run: `node --test test/commitlint-runner.test.mjs test/hook-dispatcher.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit commit-message enforcement**

Run: `but commit -b gitbutler-commit-standard -m "feat: enforce conventional commit messages"`

Expected: a Conventional Commit on the GitButler branch.

### Task 6: Global installer, updater, and uninstall restoration

**Files:**
- Create: `gitbutler-commit-standard/scripts/install.mjs`
- Create: `gitbutler-commit-standard/scripts/uninstall.mjs`
- Create: `gitbutler-commit-standard/scripts/yaml-lite.mjs`
- Create: `gitbutler-commit-standard/test/install.test.mjs`

**Interfaces:**
- Consumes: `installBut`, the hook dispatcher path, config serialization, and the Cordis registration entry produced in Task 7.
- Produces: `npm run install:harness`, `npm run uninstall:harness`, and `--dry-run` behavior.

- [ ] **Step 1: Write failing installer tests with fake Git configuration**

```js
test('dry-run reports but installation, hook path, and plugin patch without changing Git', async () => {
  const result = await install({ dryRun: true, git: fakeGit('custom-hooks'), but: missingBut() })
  assert.match(result.output, /would install GitButler/)
  assert.equal(result.gitWrites.length, 0)
})

test('uninstall restores only the hooksPath originally managed by the package', async () => {
  const git = fakeGit('managed-hooks')
  await uninstall({ git, state: { previousHooksPath: 'custom-hooks' } })
  assert.equal(git.globalHooksPath, 'custom-hooks')
})
```

- [ ] **Step 2: Run installer tests to verify they fail**

Run: `node --test test/install.test.mjs`

Expected: FAIL because installer modules do not exist.

- [ ] **Step 3: Implement guarded installation and restoration**

```js
export async function install({ dryRun, confirmInstall, git, but }) {
  await ensureBut({ confirmInstall, but })
  await ensureCommitlintRuntime()
  await installManagedHooksPath({ dryRun, git })
  await patchCordisConfig({ dryRun })
}
```

Persist managed-state metadata outside repositories. Require confirmation before
replacing a non-managed global hooks path; make the dispatcher chain the old
path when the user chooses migration. Link the package and copy the skill in
the same machine-wide locations used by `coding-doc-standard`.

- [ ] **Step 4: Run installer tests to verify they pass**

Run: `node --test test/install.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the installer**

Run: `but commit -b gitbutler-commit-standard -m "feat: install global GitButler commit enforcement"`

Expected: a Conventional Commit on the GitButler branch.

### Task 7: Cordis registration and full settings UI

**Files:**
- Create: `gitbutler-commit-standard/register-hooks.mjs`
- Create: `gitbutler-commit-standard/client.js`
- Modify: `gitbutler-commit-standard/package.json`
- Create: `gitbutler-commit-standard/test/register-hooks.test.mjs`

**Interfaces:**
- Consumes: `readConfig`, `writeConfig`, `languageSettingsToExtensions`-style settings persistence pattern from the existing coding-doc-standard package.
- Produces: Cordis `apply(ctx, config)` and settings namespace `gitbutler-commit-standard`.

- [ ] **Step 1: Write failing registration and settings tests**

```js
test('plugin declares shell injection required by the command guard', () => {
  assert.deepEqual(inject, ['shell'])
})

test('settings update writes a disabled command guard atomically', async () => {
  const next = settingsToConfig({ enabled: true, commandGuard: false, commitlint: true })
  assert.equal(next.commandGuard, false)
})
```

- [ ] **Step 2: Run registration tests to verify they fail**

Run: `node --test test/register-hooks.test.mjs`

Expected: FAIL because registration and settings exports do not exist.

- [ ] **Step 3: Implement registration and the settings card**

```js
export const name = 'gitbutler-commit-standard'
export const inject = ['shell']
export async function apply(ctx, config = {}) { /* mount bridge and settings section */ }
export function settingsToConfig(value) { /* normalize all policy controls */ }
```

Provide controls for standard state, CLI status/repair, command guard,
commitlint, profile mode, repository exclusions, and diagnostics. Keep a
visible read-only list of allowed Git inspection commands and do not offer a
`--no-verify` or temporary bypass control.

- [ ] **Step 4: Run registration tests to verify they pass**

Run: `node --test test/register-hooks.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit plugin and settings UI**

Run: `but commit -b gitbutler-commit-standard -m "feat: add GitButler policy settings"`

Expected: a Conventional Commit on the GitButler branch.

### Task 8: End-to-end verification, documentation, and package audit

**Files:**
- Modify: `gitbutler-commit-standard/README.md`
- Modify: `gitbutler-commit-standard/SKILL.md`
- Modify: `gitbutler-commit-standard/scripts/test.mjs`
- Modify: `gitbutler-commit-standard/.npmignore`

**Interfaces:**
- Consumes: all production modules.
- Produces: repeatable end-to-end verification with isolated fake binaries and a publishable npm archive.

- [ ] **Step 1: Write failing end-to-end tests**

```js
test('raw git commit is blocked before execution and recommends but commit', async () => {
  const result = await runGuard('git commit -m "fix: x"')
  assert.equal(result.exitCode, 2)
  assert.match(result.stderr, /but commit -b/)
})

test('managed commit-msg hook rejects a non-conventional message', async () => {
  const result = await runCommitMsg('message\n')
  assert.equal(result.exitCode, 1)
})
```

- [ ] **Step 2: Run end-to-end tests to verify they fail before wiring completes**

Run: `node --test test/*.test.mjs`

Expected: FAIL until the end-to-end helpers and wiring are added.

- [ ] **Step 3: Add isolated integration helpers and complete user documentation**

```js
const environment = await createTemporaryGitEnvironment({
  but: fakeBut({ version: '1.0.0' }),
  commitlint: fakeCommitlint({ conventional: true }),
})
```

Document installation confirmation, CLI repair, `but setup`, the Git command
policy, commit-message examples, custom-profile safety boundary, hook
chaining, diagnostics, and uninstall. Ensure `npm pack --dry-run --json`
includes all runtime files and no bytecode/test artifacts.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm pack --dry-run --json`

Expected: all tests pass and the package archive includes `SKILL.md`, hook
files, scripts, runtime modules, and settings client.

- [ ] **Step 5: Commit release-ready package state**

Run: `but commit -b gitbutler-commit-standard -m "docs: finalize GitButler commit standard"`

Expected: a Conventional Commit on the GitButler branch.
