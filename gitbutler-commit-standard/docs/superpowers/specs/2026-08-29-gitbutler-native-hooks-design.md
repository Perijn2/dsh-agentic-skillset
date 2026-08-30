# GitButler Native Hooks Design

**Author:** Perijn  
**Status:** Approved

## Goal

Make GitButler Commit Standard use GitButler v0.21.0's repository-native hook
chain, while preserving Conventional Commit enforcement for `but commit` and
giving the standard a bundled, version-aligned GitButler CLI reference.

## Problem

The current package sets global `core.hooksPath`. GitButler v0.21.0 instead
manages `.git/hooks/pre-commit` itself and preserves an existing user hook as
`.git/hooks/pre-commit-user`. A global hooks path prevents that repository
chain from being the active hook location.

GitButler's `but commit` runs Git hooks by default. `--no-hooks` bypasses them
and remains prohibited by the standard.

## Architecture

### Bundled GitButler skill

Install GitButler's v0.21.0 skill into `references/gitbutler/` in this package.
Include the complete skill and its references in the published package and copy
them alongside this standard's machine-wide skill. The top-level standard must
direct agents to read the bundled skill before choosing `but` syntax.

### Repository hook installation

Replace the global hooks-path dispatcher with an explicit repository setup
command run immediately after `but setup`:

1. `git init` is permitted only to bootstrap a repository.
2. `but setup` installs GitButler's managed `.git/hooks/pre-commit` hook.
3. The standard installs its `pre-commit-user` wrapper. If GitButler preserved
   an existing user pre-commit hook there, the wrapper chains it first.
4. The standard installs a native `.git/hooks/commit-msg` wrapper. It chains a
   pre-existing user `commit-msg` hook and then invokes package-local
   commitlint.

The `pre-commit-user` wrapper participates in GitButler's v0.21.0 chain. The
`commit-msg` hook remains the validation point because it receives the proposed
commit-message path, which commitlint requires.

The repository hook installer is idempotent. It never overwrites a user hook:
it moves an unmarked existing hook to a standard-owned `*-user` backup before
writing its wrapper. Re-running it recognizes its markers and leaves the
backups intact.

### Migration

The machine-wide installer must stop configuring `core.hooksPath`. If its
current value is this package's prior managed path, it removes that value so
GitButler can use `.git/hooks`. It must not replace or restore any other global
hooks path, because the old installer did not reliably retain the original
value.

### Agent-facing explanation

`SKILL.md` must contain a concise “How it works” section:

`git init` → `but setup` → GitButler `pre-commit` → standard
`pre-commit-user` → native `commit-msg` → commitlint.

It must state that agents use the bundled GitButler reference, run the
repository hook installer after `but setup`, and never pass `--no-hooks`.

## Verification

- Unit-test the migration plan and the idempotent repository-hook installer.
- Test preservation and execution order for existing `pre-commit-user` and
  `commit-msg` hooks.
- Add a real temporary-repository `commit-msg` test: an invalid message fails
  and a Conventional Commit message succeeds through the installed hook.
- Run the complete Node test suite and the machine-wide installer dry run.
