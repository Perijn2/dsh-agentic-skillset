# GitButler Commit Standard

Machine-wide DeepSeek Harness enforcement for a GitButler-first agent workflow
and Conventional Commit messages.

## What it enforces

- The Harness command guard allows ordinary read-only Git inspection.
- Raw Git mutations with a GitButler `but` replacement are blocked. Git
  workflows without a GitButler equivalent, including submodule management,
  remain available.
- `--no-verify` is blocked.
- GitButler owns each repository's `pre-commit` hook. The standard installs a
  `pre-commit-user` wrapper so GitButler can call it, and a native `commit-msg`
  wrapper that preserves any prior hook before running commitlint using
  `@commitlint/config-conventional`. Commit messages must also include a
  non-empty body describing the change.
- The installer verifies `but`; when absent, it uses GitButler's official
  installer only with `--yes-install-gitbutler` confirmation.

## Install

From this package directory, install dependencies and preview the global
changes:

```bash
npm install
node scripts/install.mjs --dry-run
```

Install with the GitButler CLI if needed:

```bash
node scripts/install.mjs --yes-install-gitbutler
```

Restart the DeepSeek Harness server after installation. The settings page is
available under **Settings → Plugins → GitButler Commit Standard**.

The installer does not change an existing `core.hooksPath`. In every repository
where the standard should enforce commits, run this sequence:

```bash
git init # only for a new repository
but setup
node ~/.dsh/node_modules/gitbutler-commit-standard/scripts/install-repository-hooks.mjs
```

`but setup` creates the GitButler hook. The final command installs the standard
wrappers and is safe to rerun if GitButler repairs its hook. Agents must finish
this sequence before changing files or committing in a newly initialized
repository.

## Verify

```bash
npm test
node scripts/install.mjs --dry-run
```

See [SKILL.md](SKILL.md) for the required agent workflow.
