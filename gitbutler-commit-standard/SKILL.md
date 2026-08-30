---
name: gitbutler-commit-standard
description: >-
  Enforces GitButler for agent-driven Git mutations and Conventional Commit
  messages through commitlint. Load before branching, committing, publishing,
  or reviewing version-control work in a DeepSeek Harness workspace.
---

# GitButler Commit Standard

Use GitButler's `but` CLI whenever it has an equivalent for the requested Git
operation. Raw Git remains available for workflows GitButler does not support,
such as submodule management.

Before selecting `but` commands or flags, read the bundled GitButler v0.21.0
reference at `references/gitbutler/SKILL.md`.

## Hard rules

- Never use `git add`, `git commit`, `git checkout`, `git switch`, `git
  branch` mutations, `git merge`, `git rebase`, `git push`, `git pull`, `git
  stash`, or other Git mutations for which GitButler provides an equivalent.
- Use raw Git only when GitButler has no equivalent, such as `git submodule
  add <repository-url> <path>`.
- Never use `--no-verify`.
- Never use `but commit --no-hooks`; it bypasses the GitButler hook chain.
- Use a Conventional Commit message. Examples: `feat: add policy settings`,
  `fix(hooks): preserve native commit-msg validation`, `docs: explain setup`.
- If GitButler has not initialized the repository, ask the user before running
  `but setup` when target-branch selection is not explicit.
- After `git init` in a new repository, before making changes or committing,
  run `but setup` and then
  `node ~/.dsh/node_modules/gitbutler-commit-standard/scripts/install-repository-hooks.mjs`.
  Do not continue the workflow if either command fails.
- Do not invent branch, target, commit, or publication intent; ask the user
  when it is missing.

## Permitted Git inspection

You may use `git status`, `git diff`, `git log`, `git show`, `git blame`, `git
ls-files`, `git rev-parse`, `git branch --show-current`, `git remote -v`, and
read-only `git config --get` or `git config --list` forms.

## GitButler workflow

1. Inspect the working state with `but status` or permitted Git inspection.
2. Create or apply work with the command forms in `references/gitbutler/SKILL.md`.
3. Review changes with `but diff`.
4. Commit with `but commit <branch> -m "type: concise description"`.
5. Update and publish with `but pull` and `but push <branch>`.

## How it works

Run this setup once in each repository:

```text
git init → but setup → node ~/.dsh/node_modules/gitbutler-commit-standard/scripts/install-repository-hooks.mjs
```

The initialization sequence is mandatory before an agent changes files or
creates a commit in a newly initialized repository.

GitButler v0.21.0 owns the repository `pre-commit` hook and invokes its
preserved `pre-commit-user` hook first. The standard installs its own wrapper
there without discarding an existing user hook. It also installs a native
`commit-msg` wrapper, which receives the proposed message and runs commitlint.
This keeps GitButler's hooks active while enforcing Conventional Commits for
ordinary `but commit` commands.
