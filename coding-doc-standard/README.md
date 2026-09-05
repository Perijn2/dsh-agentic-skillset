# coding-doc-standard

A universal, language-agnostic **coding documentation standard** for the
DeepSeek Harness, shipped as an installable package that **enforces itself** on
every code write/edit through the harness's hook system.

Applies to: **C/C++, Python, TypeScript, JavaScript, Rust.**

---

## What it does

When installed, the harness runs a `PreToolUse` hook on **every `write` and
`edit` tool call**. The hook validates the *pending content*, before the tool
changes the target file:

- **File / module header** must exist with `Author`, `Summary`, and an advanced `Usage` guide.
- **Author** must be a real, user-confirmed name - never a guess or placeholder.
- **Unit doc** must exist on every public unit (function, class, type, etc.).

A non-compliant file is **BLOCKED** (the tool call is rejected) with the
specific violations printed to stderr, so the agent must either fix the docs or
**ask the user for the missing information** - it may never guess.

```
path/to/file.py:1 [doc-standard] Missing 'Author' in file header
path/to/file.py:10 [doc-standard] Missing unit doc for public unit 'foo'
[doc-standard] 3 violation(s). Fix these or ask the user for missing information - do not guess.
```

---

## Package layout

```
coding-doc-standard/
+-- package.json
+-- SKILL.md               # general documentation contract
+-- c-cpp.md               # C/C++ reference
+-- python.md               # Python reference
+-- typescript-javascript.md # TypeScript/JavaScript reference
+-- rust.md                 # Rust reference
+-- register-hooks.mjs      # cordis plugin: wires the CC hooks bridge to this config
+-- hooks.json              # the PreToolUse hook definition (matcher: write|edit)
+-- run-check.sh            # stdin wrapper: extracts tool_input.file_path, runs the checker
+-- src/
|   +-- checker.py          # the content-aware checker (stdlib-only Python)
+-- scripts/
|   +-- test.mjs            # self-contained test matrix
|   +-- install.mjs         # installs the plugin into the harness cordis config
|   +-- yaml-lite.mjs       # dependency-free YAML handling for the patch layer
+-- README.md
```

The standard is installed as a **skill** at
`~/.dsh/skills/coding-doc-standard/`. `SKILL.md` is the general enforcer and
links to concise C/C++, Python, TypeScript/JavaScript, and Rust references.
Load only the reference for the language being written or reviewed.

---

## The hard rule (never guess)

This is the rule the checker enforces mechanically. When writing or updating
documentation, if any required piece of information is **unknown, missing, or
not yet implemented**, you must **stop and ask** the user before writing the doc.
You must never:

- guess or invent an author name,
- describe behavior the code does not actually have,
- invent parameter meanings, units, ranges, or return shapes,
- fabricate error types or failure modes,
- write a usage example that does not reflect real, working code,
- fill a required field with a placeholder (`TODO`, `unknown`, `FIXME`, your own
  name, a generic string) **unless the user explicitly told you to use placeholders.**

If you are a subagent that cannot call `ask_user_question`, **stop and return to
the orchestrator** with a precise list of the missing fields.

---

## The recurring style (same across all languages)

Two document shapes, each with **fixed section words**. The words never change
across languages - only the comment syntax does.

### File / module header (one per file)

1. **Author** - who wrote the file. Required. Never invented.
2. **Summary** - one line: what this file/module is for.
3. **Usage** - an advanced module guide covering the core principle, setup,
   workflow, task-oriented API guide, and runnable worked example.
4. **Notes** *(optional)* - omit if empty.

Do not use an `Includes` field. It duplicates declaration-level documentation
and becomes stale.

### Unit doc (one per public unit)

1. **Summary** - always line 1, one sentence, ends with a period.
2. **Behavior** - omit if fully self-evident.
3. **Parameters** - omit if none.
4. **Returns** - omit if none.
5. **Errors** - omit if none.
6. **Example** - omit if none.
7. **Notes** - omit if none.

### Language mappings

| Field | C/C++ | Python | TS/JS | Rust |
|---|---|---|---|---|
| Author | `@author` | `Author:` | `@author` | `# Author` |
| Summary | `@brief` | docstring line 1 | `@module` first line | first `//!` line |
| Usage | `Usage:` with `@code` | `Usage:` | `Usage:` in prose or `@remarks` | `# Usage` |
| Notes | `@note` | `Notes:` | `@remarks` | `# Notes` |

See `~/.dsh/skills/coding-doc-standard/SKILL.md` for the full worked examples.

For C/C++ public APIs, Doxygen documentation must include a non-empty
`@brief`, one direction per named parameter (`@param[in]`, `@param[out]`, or
`@param[in,out]`), and `@return` or `@retval` for non-`void` functions.

For other language-specific enforcement, the checker applies PEP 257 summary
structure to Python, TSDoc/JSDoc `@param` and `@returns`/`@yields` coverage to
exported TS/JS functions, and `# Safety` to public Rust unsafe items. Rust
projects should also enable the native compiler/Clippy checks:

```rust
#![deny(missing_docs)]
#![deny(clippy::missing_errors_doc, clippy::missing_panics_doc)]
#![deny(clippy::missing_safety_doc)]
```

---

## Install

```bash
# From this package directory:
node scripts/install.mjs

# Or target a specific cordis patch layer:
node scripts/install.mjs --config ~/.dsh/cordis.patch.yml

# Preview the change without writing:
node scripts/install.mjs --dry-run
```

The install script:

1. Validates the package (checker, wrapper, config, plugin all present).
2. Ensures a single `coding-doc-standard` plugin row in the cordis patch layer,
   pointing at this package's `register-hooks.mjs` and `hooks.json`.
3. Replaces any legacy direct `hooks-claude-code` registration so the bridge
   mounts **exactly once**.

**After installing, restart the harness server** so the plugin mounts (config is
read at boot).

To uninstall, remove the `coding-doc-standard` row from the cordis patch layer
(`~/.dsh/cordis.patch.yml`) and restart.

## Settings

In **Settings -> Plugins -> coding-doc-standard**, the first settings page offers
an enforcement switch plus individual language switches for Python,
TypeScript/JavaScript, Rust, and C/C++. Changes are written atomically to
`config.json`; the checker loads that policy for every hook invocation, so the
next write/edit reflects the change without restarting the harness.

---

## How it works (internals)

1. The cordis loader mounts `register-hooks.mjs` (this package's plugin).
2. The plugin resolves and calls the **Claude Code hooks bridge**
   (`@deepseek-ai/dsh-hooks-claude-code`), passing this package's `hooks.json`
   as its `configPath`.
3. The bridge registers a `tools/pre-execute` listener for the `PreToolUse`
   events declared in `hooks.json` (matcher `write|edit`).
4. On each `write`/`edit` call, the harness invokes the configured command -
   `run-check.sh` - with the tool payload on stdin.
5. `run-check.sh` takes `tool_input.content` for writes, or applies the exact
   `old_string` -> `new_string` edit in memory. It pipes that candidate to
   `checker.py`; the target is never modified merely to validate it.
6. The checker exits `2` (block) with violations on stderr for a non-compliant
   file, or `0` (allow) for a compliant / out-of-scope file.

The plugin resolves the bridge by package name first, falling back to a
filesystem walk up from the plugin (and an explicit `DSH_HOOKS_CLAUDE_CODE_PATH`
env var), so it works whether or not the bridge is a declared dependency.

---

## Tests

```bash
npm test        # runs scripts/test.mjs - the checker's self-contained matrix
```

The matrix covers the compliant and violating cases for Python, TypeScript, and
Rust, policy configuration, pending writes and edits, out-of-scope directories,
empty files, stubs, and the npm package contents.

## Project ignore list

Projects can commit a `.coding-doc-standard-ignore` file at their root to exempt
pre-existing or generated code from this standard. The checker finds the
nearest such file above the target and evaluates each non-empty line relative
to that project root. Blank lines and lines beginning with `#` are ignored.

```gitignore
# Pre-existing library
legacy-library/**
src/generated/client.ts
```

Patterns must be non-empty relative paths. Absolute patterns and paths that
contain `..` are ignored. The project ignore list supplements the global policy;
files that do not match it are checked normally.
