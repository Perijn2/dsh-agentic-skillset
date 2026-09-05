---
name: coding-doc-standard
description: >-
  Universal coding documentation standard for C/C++, Python, TypeScript,
  JavaScript, and Rust. Defines the general documentation contract and links to
  concise language-specific rules. Load the matching language reference only
  when that language is in scope.
---

# Coding Documentation Standard

This file is the general enforcer for **C, C++, Python, TypeScript,
JavaScript, and Rust**. Apply it first, then load only the language reference
needed by the task:

| Language | Reference |
|---|---|
| C / C++ | [c-cpp.md](c-cpp.md) |
| Python | [python.md](python.md) |
| TypeScript / JavaScript | [typescript-javascript.md](typescript-javascript.md) |
| Rust | [rust.md](rust.md) |

Do not load irrelevant language references. Load each applicable reference for
a multi-language task.

## The Hard Rule: Stop and Ask, Never Guess

When writing or updating documentation, stop and ask the user if any required
information is unknown, missing, or unimplemented. Never invent an author,
behavior, parameter meaning, unit, range, return shape, error, failure mode, or
usage example. Never use a placeholder unless the user explicitly permits it.

Ask exactly for the missing field:

| Missing item | Ask the user |
|---|---|
| Author | "Who is the author of this file/module? I will not guess a name." |
| Behavior unclear or unimplemented | "What is the intended behavior of `<unit>`? The current code does not define it." |
| API contract not derivable from code | "What are the exact parameters, return value, and error cases for `<unit>`?" |
| Usage guide not derivable from real code | "What are this module's core principle, setup and lifecycle, public API, and intended call patterns so I can write a correct Usage guide?" |
| Module purpose or public API unclear | "What is this file for, and what public API does it expose?" |

Use `ask_user_question` when available. A subagent without it returns the
precise missing fields to its orchestrator. If placeholders are explicitly
allowed, clearly mark them and list them in the final report.

## Project Ignore List

A project may commit `.coding-doc-standard-ignore` to exempt existing libraries
or generated code. The checker uses the nearest file above the target and
matches non-empty lines relative to its directory. Ignore blank lines and `#`
comments; absolute paths and patterns containing `..` are invalid.

```gitignore
# Pre-existing library
legacy-library/**
src/generated/client.ts
```

## Required document shapes

Use the same fixed section words in every language; only comment syntax varies.

### File / module header

Every file begins with one header, in this order:

1. **Author** - required; never invented.
2. **Summary** - one sentence describing the module.
3. **Usage** - an advanced, code-derived guide to using the complete module,
   not a terse import line or export inventory. In this order, cover:
   - **Core principle** - the design model and responsibility the module owns.
   - **Setup** - the real import, require, or include plus required construction,
     configuration, or initialization.
   - **Workflow** - the normal lifecycle or call sequence, including ordering,
     state transitions, side effects, and cleanup when applicable.
   - **API guide** - every public entry point grouped by task; explain what it
     does, when to choose it, and how its result is used without duplicating
     declaration-level contracts.
   - **Worked example** - a realistic, runnable end-to-end primary workflow
     that handles meaningful results or failures.
   Omit only a genuinely inapplicable subpart; keep the guide proportional to
   the public surface but complete enough for a new caller to use it correctly.
4. **Notes** *(optional)* - omit when empty.

Do **not** use an `Includes` field. It duplicates declarations and becomes
stale; the task-oriented Usage API guide replaces it.

### Public-unit documentation

Attach documentation to every public function, method, class, struct, trait,
enum, or exported constant in this order:

1. **Summary** - first content line; one sentence ending in a period.
2. **Behavior** *(when not self-evident)*.
3. **Parameters**.
4. **Returns**.
5. **Errors**.
6. **Example**.
7. **Notes** *(optional)*.

Omit empty sections; never fabricate content to fill one. Public means
exported, externally linked, or part of the API surface. Stale docs are a
review blocker.

## Whitespace and layout

Documentation is prose for people first.

- File headers and public-unit docs use multiline native syntax, even for a
  short Summary.
- Place the Summary first, followed by exactly one blank documentation line
  before Usage, Behavior, or the first populated section.
- Use exactly one blank documentation line between logical sections, tag
  groups, or heading groups; keep entries within one group together.
- Keep tags and headings on their own lines. Never place `@brief`, `@param`,
  `@return` / `@returns`, `@throws`, `@example`, `@note` / `@remarks`, or a
  Rust `#` heading on the Summary line or directly beside an unrelated group.
- Wrap at natural phrase boundaries and indent continuation lines farther than
  their tag, label, bullet, or list marker.
- Do not add decorative blank-line runs or trailing whitespace.

## General review checklist

Report missing required docs or fabricated content as **blockers**, missing
optional-but-expected content as **major**, and style deviations as **minor**.

1. Does every file have Author, Summary, and a complete Usage guide, with no
   Includes field?
2. Is the author real and user-confirmed?
3. Does Usage cover the core principle, setup, workflow, task-oriented public
   API, and a runnable end-to-end example wherever each applies?
4. Can a new caller use every public capability correctly from Usage without it
   duplicating the declaration-level API reference?
5. Does every public unit have an accurate Summary and applicable contract docs?
6. Are empty sections omitted and fixed section words used?
7. Do docs match current behavior?
8. Are required docs multiline with one blank documentation line at section
   boundaries?
9. Was the applicable language reference loaded and followed?

If information is missing rather than wrong, report **"ask the author/user"**
instead of proposing invented text.
