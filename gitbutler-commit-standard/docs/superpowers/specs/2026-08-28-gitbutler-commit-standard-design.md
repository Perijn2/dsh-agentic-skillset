# GitButler Commit Standard — Architecture Proposal

## Purpose

Create a machine-wide DeepSeek Harness package, `gitbutler-commit-standard`,
that makes GitButler the required mutation workflow for coding agents and
enforces Conventional Commit messages with commitlint. The package applies to
every repository by default and is configurable from the Harness settings UI.

The standard permits ordinary, read-only Git inspection. It blocks stateful
Git commands issued through the Harness and directs the agent to the relevant
GitButler `but` command. It does not replace Git system-wide.

## Goals

- Require `but` for Git state changes made by agents in the Harness.
- Allow safe inspection with `git status`, `git diff`, `git log`, `git show`,
  `git rev-parse`, `git config --get`, and other explicitly classified
  read-only commands.
- Validate every commit message through commitlint's Conventional Commits
  profile by default.
- Install and verify the GitButler CLI when the package is installed and it is
  absent.
- Preserve existing Git hooks instead of replacing or silently bypassing them.
- Provide one global policy with explicit, reviewable per-repository settings.
- Permit future approved custom commitlint profiles without weakening the
  default enforcement.

## Non-goals

- Intercepting all Git usage outside the DeepSeek Harness.
- Replacing GitButler's own workspace, branch, authentication, or forge
  configuration.
- Auto-generating commit messages or silently bypassing failures with
  `--no-verify`.
- Enabling arbitrary executable commitlint configuration from repositories by
  default.

## Package layout

```text
gitbutler-commit-standard/
├── SKILL.md
├── README.md
├── package.json
├── config.json
├── register-hooks.mjs
├── hooks.json
├── client.js
├── src/
│   ├── command-guard.mjs
│   ├── command-policy.mjs
│   ├── gitbutler.mjs
│   ├── commitlint-runner.mjs
│   ├── hook-dispatcher.mjs
│   └── diagnostics.mjs
├── hooks/
│   └── commit-msg
└── scripts/
    ├── install.mjs
    ├── install-gitbutler.mjs
    ├── install-commitlint.mjs
    └── test.mjs
```

`SKILL.md` is the human-facing standard. It documents the required GitButler
workflow, the permitted inspection commands, command substitutions, commit
message expectations, and recovery steps. It explicitly forbids `--no-verify`
and asks the user when a required branch, target, or commit intent is unknown.

## Runtime architecture

```text
Harness shell/terminal request
          |
          v
PreToolUse command guard
  |-- non-Git command ----------------------------> allow
  |-- read-only git command ----------------------> allow
  |-- recognized mutating git command ------------> block + but remediation
  |-- uncertain/shell-composed git invocation ----> block + ask for a simple but command
  `-- but command --------------------------------> prerequisite/status validation
                                                        |
                                                        v
                                                 GitButler CLI
                                                        |
                                                        v
                                       managed global commit-msg dispatcher
                                                        |
                                   +--------------------+-------------------+
                                   |                                        |
                                   v                                        v
                         existing repository hook                   commitlint runner
                                                                      |
                                                                      v
                                                        Conventional Commits profile
```

`register-hooks.mjs` follows the existing `coding-doc-standard` integration
pattern: it mounts the Harness hook bridge, registers the command guard for
shell/terminal execution events, and registers a settings namespace. The
guard decides only whether an invocation is permitted; it never performs the
Git operation itself.

## Command policy

The policy is an allowlist, not a heuristic based on command output.

### Allowed Git inspection

Examples include `git status`, `git diff`, `git log`, `git show`, `git blame`,
`git ls-files`, `git rev-parse`, `git remote -v`, `git branch --show-current`,
and read-only `git config --get`/`--list` forms. The exact allowlist is stored
in `config.json` and visible in settings.

### Blocked Git mutation families

The guard blocks `git add`, `commit`, `amend`, `reset`, `restore`, `checkout`,
`switch`, `branch` mutations, `merge`, `rebase`, `cherry-pick`, `revert`,
`stash`, `tag` mutations, `push`, `pull`, `fetch`, `clean`, `worktree`,
`submodule` mutations, and any invocation using `--no-verify`.

For each recognized form it reports a direct alternative, such as:

| Blocked request | Required replacement |
|---|---|
| `git commit -m ...` | `but commit -b <branch> -m ...` |
| `git switch` / branch creation | `but branch new`, `but apply`, or `but unapply` |
| `git rebase` / `git merge` | the appropriate GitButler stack/update operation |
| `git push` / `git pull` | `but push` / `but pull` |
| `git stash` | assign, commit, or discard work through GitButler |

The parser accepts a direct executable and argument vector. Shell strings with
operators, command substitution, aliases, wrappers, or unparseable composition
are denied when they contain a Git mutation. The remediation requests a simple
`but` invocation; this fail-closed behavior prevents bypasses through shell
syntax. Non-Git shell commands remain out of scope.

## GitButler prerequisite and repository setup

During package installation, the installer runs `but --version`. If it is not
available, it presents the official GitButler installer and requires explicit
confirmation before network installation. On supported Unix-like systems it
runs GitButler's published installer, refreshes PATH resolution, and verifies
the resulting executable. Unsupported platforms or a failed verification leave
the standard uninstalled/disabled with an actionable manual-install message.

The guard detects a repository that has not been initialized for GitButler and
reports that `but setup` is required. It does not choose a target branch or
run setup non-interactively: that action changes repository state and may need
user input.

## Commit-message enforcement

The installer creates a managed global hooks directory and configures Git's
global `core.hooksPath` to use it. Its `commit-msg` dispatcher:

1. receives Git's commit-message file;
2. invokes the repository's pre-existing native `commit-msg` hook, if present
   and not the dispatcher itself;
3. resolves the active commitlint profile;
4. runs commitlint against the exact message file; and
5. exits nonzero on either chained-hook or commitlint failure.

The installer backs up the prior global `core.hooksPath` value and refuses to
replace an unmanaged path without user confirmation. Uninstall restores the
recorded value only when the managed dispatcher is still active.

The default profile is a package-managed install of `@commitlint/cli` plus
`@commitlint/config-conventional`. No agent command may pass `--no-verify`.
The command guard also rejects direct `git commit`; the hook remains necessary
because GitButler ultimately creates Git commits and because users can commit
outside the Harness.

## Configuration and settings

The package writes an atomically updated global `config.json` and exposes
Settings → Plugins → GitButler Commit Standard. It includes:

- standard enabled state;
- GitButler CLI requirement, detected path, version, and repair action;
- command-guard enabled state;
- displayed read-only Git allowlist and configurable extra blocked forms;
- commitlint enabled state;
- default profile (`conventional`);
- repository profile discovery mode: disabled, approved repository JSON only,
  or required approved repository profile;
- explicit absolute-path repository exclusions; and
- diagnostics for CLI, hook dispatcher, commitlint resolution, and a
  non-mutating self-check.

Per-repository configuration is disabled by default. When enabled, only a
declarative JSON policy file from a named location is read. A later extension
can add signed or centrally registered profiles. JavaScript/TypeScript
commitlint configuration files are not loaded automatically because they are
executable code.

## Error handling

- Missing `but`: block mutating workflow commands and offer repair/install.
- GitButler setup needed: block the requested mutation and instruct the agent
  to ask the user before `but setup` if target selection is ambiguous.
- Missing Node or commitlint runtime: installation fails closed; diagnostics
  explain the missing prerequisite.
- Invalid commit message: the dispatcher returns commitlint's output unchanged
  so the author can correct the message.
- Existing hooks-path conflict: installation stops until the user chooses to
  chain, migrate, or decline.
- Hook or parser internal failure: default to blocking mutations with a clear
  diagnostic; never silently permit a raw Git mutation.

## Testing strategy

`scripts/test.mjs` should cover command-policy classification, argument-vector
and shell-string cases, every blocked mutation family, allowed inspection,
`--no-verify`, unknown syntax, GitButler availability/setup failures, settings
serialization, hook chaining, conventional-message pass/fail cases, repository
profile modes, installer dry-run output, upgrade/uninstall restoration, and
published package contents. Tests use temporary repositories and fake `but`,
Git, and commitlint executables; they must never change a developer's global
Git configuration.

## Rollout

1. Ship a dry-run installer and diagnostics first.
2. Install the CLI prerequisite and managed hook dispatcher.
3. Enable command guarding only after its self-check passes.
4. Keep the conventional profile as the sole default.
5. Add repository-specific custom profiles only through a subsequent,
   explicitly designed compatibility extension.

## References

- GitButler CLI installation and setup:
  https://docs.gitbutler.com/cli-guides/installation
- GitButler AI-agent setup:
  https://docs.gitbutler.com/ai-agents/getting-started
- GitButler CLI command reference:
  https://docs.gitbutler.com/cli/cheat
- commitlint local hook setup:
  https://commitlint.js.org/guides/local-setup
- commitlint configuration:
  https://commitlint.js.org/reference/configuration.html
