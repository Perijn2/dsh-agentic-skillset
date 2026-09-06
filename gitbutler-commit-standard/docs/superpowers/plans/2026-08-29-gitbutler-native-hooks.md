# GitButler Native Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global Git hooks-path dispatcher with GitButler v0.21.0-compatible repository hooks and bundle the GitButler CLI skill.

**Architecture:** The global installer leaves `core.hooksPath` unset so GitButler owns `.git/hooks/pre-commit`. A new repository installer writes chain-preserving `pre-commit-user` and `commit-msg` wrappers after `but setup`; the latter runs package-local commitlint. The package ships a copied GitButler v0.21.0 skill and routes its own standard to that reference.

**Tech Stack:** Node.js ESM, Bash hook wrappers, Git, GitButler v0.21.0, `@commitlint/cli`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-29-gitbutler-native-hooks-design.md`

## Global Constraints

- Target GitButler CLI: v0.21.0.
- Permit `git init`; keep other raw agent Git mutations blocked.
- Do not configure global `core.hooksPath`.
- Preserve executable repository hooks before wrapping them.
- `but commit --no-hooks` and raw `--no-verify` remain forbidden.
- Use Conventional Commits unless a future configured profile replaces it.

---

### Task 1: Bundle and route to the GitButler CLI skill

**Files:**
- Create: `references/gitbutler/SKILL.md`
- Create: `references/gitbutler/references/concepts.md`
- Create: `references/gitbutler/references/examples.md`
- Create: `references/gitbutler/references/reference.md`
- Modify: `SKILL.md`
- Modify: `package.json`
- Modify: `scripts/install.mjs`
- Test: `test/client-manifest.test.mjs`

**Interfaces:**
- Consumes: `but skill install --path <package>/references/gitbutler` output.
- Produces: an installed `~/.dsh/skills/gitbutler-commit-standard/references/gitbutler/SKILL.md` reference.

- [ ] **Step 1: Write the failing package/skill assertions**

Add assertions that `package.json` publishes `references/gitbutler/`, that the
machine-wide installer copies the reference tree, and that `SKILL.md` directs
agents to `references/gitbutler/SKILL.md` before using `but` syntax.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test test/client-manifest.test.mjs`  
Expected: FAIL because the bundled reference and routing language do not exist.

- [ ] **Step 3: Install the version-aligned reference and update distribution**

Run `but skill install --path /home/perijn/Projects/Workspace/agentic-skills/gitbutler-commit-standard/references/gitbutler`. Add `references/` to the package files list. Replace the installer’s single-file skill copy with recursive copying of `SKILL.md` plus `references/` to the DSH skill directory.

- [ ] **Step 4: Update the standard’s workflow explanation**

Add a concise “How it works” section to `SKILL.md` with this sequence:

```text
git init → but setup → GitButler pre-commit → pre-commit-user → commit-msg → commitlint
```

State that `pre-commit-user` is GitButler’s preserved user-hook entry, that
`commit-msg` performs message validation, and that `--no-hooks` is forbidden.

- [ ] **Step 5: Run the targeted test to verify it passes**

Run: `node --test test/client-manifest.test.mjs`  
Expected: PASS.

### Task 2: Implement idempotent GitButler-native repository hook setup

**Files:**
- Create: `src/repository-hooks.mjs`
- Create: `scripts/install-repository-hooks.mjs`
- Create: `hooks/pre-commit-user`
- Modify: `scripts/install.mjs`
- Modify: `scripts/uninstall.mjs`
- Modify: `src/installer.mjs`
- Modify: `package.json`
- Test: `test/repository-hooks.test.mjs`
- Test: `test/installer.test.mjs`

**Interfaces:**
- Produces `installRepositoryHooks({ gitDir, packageRoot })`.
- Produces `buildInstallPlan({ butAvailable, activeHooksPath, managedHooksPath })` without a global hooks-path replacement action.
- `scripts/install-repository-hooks.mjs` resolves `.git/hooks` with `git rev-parse --git-path hooks` and calls `installRepositoryHooks`.

- [ ] **Step 1: Write failing hook-installer tests**

Create a temporary `.git/hooks` directory with executable `pre-commit-user` and
`commit-msg` files. Assert that installation renames them to stable user backup
names, writes marked wrappers, and that a second installation leaves the same
backups untouched. Add an installer-plan assertion that no plan requests a
global `core.hooksPath` replacement.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `node --test test/repository-hooks.test.mjs test/installer.test.mjs`  
Expected: FAIL because no repository installer exists and the old plan still
requests a hooks-path replacement.

- [ ] **Step 3: Implement repository hook installation**

Implement `installRepositoryHooks` to:

```js
installRepositoryHooks({ gitDir, packageRoot })
// writes ${gitDir}/hooks/pre-commit-user
// writes ${gitDir}/hooks/commit-msg
// preserves old executable hooks as *-user-original
```

The `pre-commit-user` wrapper executes its preserved backup, if any. The
`commit-msg` wrapper executes its preserved backup with `$1`, then runs
`node <packageRoot>/scripts/commit-msg.mjs "$1"`. Both wrappers must be
executable and carry a marker so reruns are idempotent.

- [ ] **Step 4: Remove the global hooks-path mutation**

Delete managed-hook-directory creation and `git config --global core.hooksPath`
from `scripts/install.mjs`. If the active global hooks path equals the previous
package-managed path, unset it. Update uninstall so it removes only package
state and never rewrites an unrelated global hooks path.

- [ ] **Step 5: Expose the repository setup command**

Add a package bin command named `gitbutler-commit-standard-hooks` pointing to
`scripts/install-repository-hooks.mjs`. The command must fail clearly outside a
Git repository and print that it must be run after `but setup`.

- [ ] **Step 6: Run the targeted tests to verify they pass**

Run: `node --test test/repository-hooks.test.mjs test/installer.test.mjs`  
Expected: PASS.

### Task 3: Test actual commit-message validation through the installed repository hook

**Files:**
- Modify: `test/commitlint-runner.test.mjs`
- Modify: `test/hook-dispatcher.test.mjs`
- Modify: `README.md`
- Modify: `SKILL.md`

**Interfaces:**
- Consumes the repository `commit-msg` wrapper written by Task 2.
- Produces an end-to-end proof that `but`-compatible native `commit-msg`
  validation rejects invalid messages and accepts Conventional Commits.

- [ ] **Step 1: Write the failing real-hook test**

Create a temp Git repository with `git init`, call `installRepositoryHooks`,
write two message files, and execute `<git-dir>/hooks/commit-msg <message>`.
Assert that `"invalid message"` exits nonzero and that
`"feat: validate native hook"` exits zero.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test test/commitlint-runner.test.mjs test/hook-dispatcher.test.mjs`  
Expected: FAIL because the repository wrapper is not yet part of the hook path.

- [ ] **Step 3: Adapt the dispatcher only as required by the new wrapper**

Keep `dispatchCommitMsg(messagePath)` as the package-local validation boundary.
Remove assumptions about the old managed global wrapper and retain chaining of
the preserved repository `commit-msg` hook before linting.

- [ ] **Step 4: Document installation and migration**

Update `README.md` and `SKILL.md` to use:

```bash
git init
but setup
gitbutler-commit-standard-hooks
```

Explain that `but commit` executes the hooks by default and that `--no-hooks`
is prohibited. Explain that existing user hooks are chained, not overwritten.

- [ ] **Step 5: Run the full verification suite**

Run: `npm test && node scripts/install.mjs --dry-run`  
Expected: all tests pass and dry-run reports no global `core.hooksPath` change.
