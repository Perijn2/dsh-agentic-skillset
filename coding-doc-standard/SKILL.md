---
name: coding-doc-standard
description: >-
  Universal coding documentation standard for C/C++, Python, TypeScript,
  JavaScript, and Rust. Defines the required file-header and unit-doc
  structure, the recurring section style shared across all languages, and the
  hard rule to stop and ask (never guess) when information is missing. Load
  this before writing or reviewing any code in these languages.
---

# Coding Documentation Standard

A single, language-agnostic documentation standard. The same **fixed section
words** are used in every language; only the **syntax** (comment markers,
field labels) differs. This is what keeps a multi-language project reading as
one consistent codebase.

Applies to: **C, C++, Python, TypeScript, JavaScript, Rust.**

---

## The Hard Rule: Stop and Ask, Never Guess

**This rule overrides everything else in this standard.** When writing or
updating documentation, if any required piece of information is **unknown,
missing, or not yet implemented**, you MUST **stop and ask the user** before
writing the doc. You must NEVER:

- guess or invent an author name,
- describe behavior the code does not actually have,
- invent parameter meanings, units, ranges, or return shapes,
- fabricate error types or failure modes,
- write a usage example that does not reflect real, working code,
- fill a required field with a placeholder (`TODO`, `unknown`, `FIXME`, your
  own name, a generic string) **unless the user has explicitly told you to
  use placeholders.**

### What counts as "missing information" (must ask)

| Missing item | What to ask |
|---|---|
| **Author** unknown | "Who is the author of this file/module? I will not guess a name." |
| **Behavior** unclear or code not implemented | "What is the intended behavior of `<unit>`? The current code does not define it." |
| **API contract** (params / returns / errors) not derivable from code | "What are the exact parameters, return value, and error cases for `<unit>`?" |
| **Usage example** not derivable from real code | "What is the intended call pattern for `<unit>` so I can write a correct example?" |
| **Module purpose / includes** unclear | "What is this file for, and which public units should the header list?" |

### How to ask

- Use the `ask_user_question` tool (if available) and name **exactly** the
  missing field(s). List each one. Do not proceed with the documentation
  until the user answers.
- If you are a **subagent that cannot call `ask_user_question`** (e.g. the
  Implementer role), **stop and return to the orchestrator** with a precise
  list of the missing fields. The orchestrator will ask the user and re-dispatch
  you with the answers. Do not write the doc with guessed values.

### The one exception

If the user has **explicitly** instructed you to use placeholders (e.g. "mark
unknowns as `TODO` for now"), then you may use a clearly-marked placeholder
such as `@author TODO` — and you must still list every placeholder you used in
your final report so the user can fill them in.

---

## Project Ignore List

A project may commit `.coding-doc-standard-ignore` at its root to exempt
pre-existing libraries or generated code that cannot yet meet this standard.
The checker uses the nearest ignore file above the target and matches each
non-empty line relative to that file's directory. Blank lines and `#` comments
are ignored.

```gitignore
# Pre-existing library
legacy-library/**
src/generated/client.ts
```

Use only non-empty relative patterns. Absolute paths and patterns containing
`..` are ignored. This escape hatch is for explicit project-owned exemptions;
all non-matching files remain subject to the full standard.

---

## The Recurring Style (applies to every language)

Two document shapes, each with **fixed section words**. The words never change
across languages — only the comment syntax does.

### Shape 1 — File / Module Header (one per file)

Every file begins with a header block containing these fields, **in this
order**:

1. **Author** — who wrote the file. *Required. Never invented.*
2. **Summary** — one line: what this file/module is for.
3. **Includes** — what the file contains: each public unit (function, class,
   type, constant) it exposes, one line each, with a one-clause description.
4. **Usage** — how to use the API: the import/require/include line, plus a
   minimal **worked example** showing the primary call(s). This is a usage
   guide, not just a description.
5. **Notes** *(optional)* — dependencies, platform constraints, license,
   related files. **Omit if empty.**

### Shape 2 — Unit Doc (one per public unit)

Every **public** function, method, class, struct, trait, enum, or exported
constant gets a doc block with these sections, **in this order**:

1. **Summary** — always line 1, always one sentence, always ends with a
   period.
2. **Behavior** — what it does: inputs → outputs, side effects. *Omit if
   fully self-evident from the summary.*
3. **Parameters** — each parameter: meaning, units, valid range.
4. **Returns** — what comes back: value, units, shape.
5. **Errors** — what it throws / returns on failure, and when.
6. **Example** — a minimal, runnable usage snippet.
7. **Notes** — invariants, thread-safety, performance, gotchas. *Omit if
   none.*

### Universal rules

- **Public = documented.** "Public" means exported, externally linked, or part
  of the API surface. Private/internal units: document only when non-obvious.
- **Summary is always line 1**, one sentence, ends with a period.
- **Section headers use the exact same words** in every language (Behavior,
  Parameters, Returns, Errors, Example, Notes / Author, Summary, Includes,
  Usage, Notes). Only the syntax differs.
- **Omit empty sections.** Never leave a header with nothing under it.
- **Docs live with the code** — attached to the declaration, never in a
  separate file.
- **Stale docs are a defect.** Changing behavior without updating the doc is a
  review blocker.
- **No fabricated content.** See the Hard Rule above.

---

## Language Mappings

The table below maps each fixed section onto each language's native idiom.
Use the **exact section words** from the standard; the syntax column shows how
to write them.

### File / Module Header

| Field | C / C++ (Doxygen) | Python (PEP 257 docstring) | TS / JS (TSDoc / JSDoc) | Rust (rustdoc) |
|---|---|---|---|---|
| Author | `@author <name>` | `Author: <name>` | `@author <name>` | `# Author` → `<name>` |
| Summary | `@brief` in `/** @file ...` | first line, ending in a period | first line of `/** @module ...` | first `//!` line |
| Includes | `@details` list, or `@{ ... @}` group | `Includes:` bullet list | `@remarks` / `@summary` list | `# Includes` bullet list |
| Usage | `@code ... @endcode` | `Usage:` + indented block | `@example` | `# Examples` (rustdoc-tested) |
| Notes | `@note` | `Notes:` | `@remarks` | `# Notes` |

**Header syntax per language:**
- **C/C++:** `/** @file <name> ... */` at the very top of the file.
- **Python:** the module docstring as the first statement of the file.
- **TS/JS:** a leading `/** @module <name> ... */` block above the first export.
- **Rust:** `//! ...` lines at the top of the file (inner doc comment).

### Unit Doc

| Section | C / C++ (Doxygen) | Python (PEP 257) | TS / JS (TSDoc / JSDoc) | Rust (rustdoc) |
|---|---|---|---|---|
| Summary | `@brief` in `/** ... */` | first line of `"""..."""`, ending in a period | first line of `/** ... */` | first `///` line |
| Behavior | prose after summary | prose after summary | prose after summary | prose after summary |
| Parameters | `@param[in] name desc`, `@param[out] name desc`, or `@param[in,out] name desc` | prose; name relevant arguments | TSDoc: `@param name - desc`; JSDoc: `@param [{type}] name desc` | use signature types; do not require an Arguments heading |
| Returns | `@return` / `@retval` | prose when applicable | TSDoc: `@returns desc`; JSDoc: `@returns [{type}] desc`; generators: `@yields` | use signature types; do not require a Returns heading |
| Errors | `@throw` / `@note` | `Raises:` block | `@throws {Type} desc` | `# Errors` block |
| Example | `@code ... @endcode` | `Example:` + indent | `@example` | `# Examples` (rustdoc-tested) |
| Notes | `@note` | `Note:` | `@remarks` | `# Notes` |

**Unit-doc syntax per language:**
- **C/C++:** `/** ... */` immediately above every public API declaration
  (Doxygen). The file header and each API doc must have a non-empty `@brief`.
  Document every named parameter with exactly one direction: `@param[in]`,
  `@param[out]`, or `@param[in,out]`. Non-`void` APIs also need `@return` or
  `@retval`.
- **Python:** triple-quoted docstring as the first statement of the
  function/class body. Follow PEP 257: a concise summary ending in a period;
  for multi-line docs, add a blank line before the detail. PEP 257 has no
  native `Args:` / `Returns:` / `Raises:` fields, so do not invent them.
- **TS/JS:** `/** ... */` immediately above the declaration. Every exported
  parameter needs `@param`; exported non-`void` TypeScript functions need
  `@returns`; exported generators need `@yields`. Use TSDoc's `name -
  description` form for TypeScript and allow JSDoc's optional `{type}` form
  for JavaScript. `@throws` remains conditional on documented thrown errors.
- **Rust:** `///` lines immediately above the item. Do not require redundant
  Arguments or Returns headings: rustdoc renders the signature and types.
  Public `unsafe` items need `# Safety`. Enforce `# Errors` and `# Panics`
  with Clippy rather than guessing from source text.

---

## Worked Examples

### Python

```python
"""String utilities for the acme package.

Author: Perijn
Summary: Helpers for normalizing and validating identifier strings.

Includes:
    normalize_identifier: fold an identifier to its canonical form.
    is_valid_identifier: check whether a string is a valid identifier.

Usage:
    from acme.strings import normalize_identifier
    normalize_identifier("  Hello_World  ")   # -> "hello_world"

Notes:
    Pure functions; no I/O, thread-safe.
"""

def normalize_identifier(raw: str) -> str:
    """Fold an identifier to its canonical lowercase-underscore form.

    Args:
        raw: The raw identifier string, may contain surrounding whitespace
            and mixed case.

    Returns:
        The canonical form: lowercase, whitespace collapsed to single
        underscores, leading/trailing underscores stripped.

    Example:
        >>> normalize_identifier("  Hello__World  ")
        'hello_world'

    Note:
        Empty or whitespace-only input returns the empty string.
    """
    ...
```

### TypeScript

```typescript
/**
 * @module rateLimiter
 * @author Perijn
 * Fixed-window rate limiter for API endpoints.
 *
 * @remarks
 * Includes:
 *   - RateLimiter: token-bucket limiter class.
 *   - LimiterOptions: configuration interface.
 *
 * Usage:
 *   import { RateLimiter } from "./rateLimiter";
 *   const rl = new RateLimiter({ limit: 100, windowMs: 60_000 });
 *   if (rl.take("user-1")) { /* handle request *\/ }
 */

export interface LimiterOptions {
  /** Maximum number of requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export class RateLimiter {
  /**
   * Attempt to consume one request token for a key.
   *
   * @param key - The identifier (e.g. user id) to rate-limit.
   * @returns True if the request is allowed, false if the limit is hit.
   *
   * @example
   * const ok = limiter.take("user-1");
   */
  take(key: string): boolean {
    /* ... */
  }
}
```

### Rust

```rust
//! Fixed-window rate limiter.
//!
//! # Author
//! Perijn
//!
//! # Summary
//! Token-bucket rate limiter for API endpoints.
//!
//! # Includes
//! - `RateLimiter`: the limiter.
//! - `LimiterOptions`: configuration.
//!
//! # Examples
//! ```
//! use acme::RateLimiter;
//! let rl = RateLimiter::new(100, 60_000);
//! assert!(rl.take("user-1"));
//! ```

/// Configuration for a [`RateLimiter`].
pub struct LimiterOptions {
    /// Maximum requests allowed per window.
    pub limit: u32,
    /// Window length in milliseconds.
    pub window_ms: u64,
}

/// Token-bucket rate limiter.
pub struct RateLimiter { /* ... */ }

impl RateLimiter {
    /// Attempt to consume one request token for `key`.
    ///
    /// # Arguments
    /// * `key` - The identifier (e.g. user id) to rate-limit.
    ///
    /// # Returns
    /// `true` if the request is allowed, `false` if the limit is hit.
    ///
    /// # Examples
    /// ```
    /// // let ok = limiter.take("user-1");
    /// ```
    pub fn take(&self, key: &str) -> bool { /* ... */ }
}
```

### C / C++

```c
/**
 * @file  strings.h
 * @author Perijn
 * @brief String utilities for the acme library.
 *
 * Includes:
 *   - acme_normalize_identifier: fold an identifier to canonical form.
 *   - acme_is_valid_identifier:  validate an identifier string.
 *
 * Usage:
 *   #include "strings.h"
 *   char *out = acme_normalize_identifier("  Hello_World  ");
 *   /* out -> "hello_world"; caller frees with free(). */
 *
 * @note Pure functions; no global state; thread-safe.
 */

/**
 * @brief Fold an identifier to its canonical lowercase-underscore form.
 *
 * @param[in] raw  The raw identifier string (may contain whitespace / mixed case).
 * @return     A newly allocated canonical string; caller must `free()`.
 *             Returns NULL on allocation failure.
 *
 * @code
 * char *out = acme_normalize_identifier("  Hello__World  ");
 * // out -> "hello_world"
 * @endcode
 *
 * @note Empty or whitespace-only input returns an empty string (not NULL).
 */
char *acme_normalize_identifier(const char *raw);
```

### JavaScript

```javascript
/**
 * @module rateLimiter
 * @author Perijn
 * Fixed-window rate limiter for API endpoints.
 *
 * @remarks
 * Includes:
 *   - RateLimiter: token-bucket limiter class.
 *
 * Usage:
 *   const { RateLimiter } = require("./rateLimiter");
 *   const rl = new RateLimiter({ limit: 100, windowMs: 60000 });
 *   if (rl.take("user-1")) { /* handle request *\/ }
 */

"use strict";

/**
 * Attempt to consume one request token for a key.
 *
 * @param {string} key - The identifier (e.g. user id) to rate-limit.
 * @returns {boolean} True if the request is allowed, false if the limit is hit.
 *
 * @example
 * const ok = limiter.take("user-1");
 */
RateLimiter.prototype.take = function (key) {
  /* ... */
};
```

---

## Reviewer Checklist

When **reviewing** code against this standard, check each of the following and
report every violation as a finding (severity: **blocker** for missing
required docs or fabricated content, **major** for missing optional-but-expected
sections, **minor** for style deviations):

1. Does every file have a header with **Author, Summary, Includes, Usage**?
2. Is the **Author** a real, user-confirmed name (not a guess / placeholder)?
3. Does the **Usage** section contain a real, runnable example (not invented)?
4. Does every **public** unit have a doc block with a one-line **Summary**?
5. For C/C++, do the file header and every public API block have a non-empty
   `@brief`?
6. For C/C++, does every parameter have exactly one valid direction:
   `@param[in]`, `@param[out]`, or `@param[in,out]`? Does every non-`void`
   API have an accurate `@return` or `@retval`?
7. Are **Parameters / Returns / Errors** present and accurate where
   non-trivial?
8. Are empty sections omitted (no orphan headers)?
9. Do the docs match the actual code behavior (no stale / fabricated claims)?
10. Are the section **words** consistent with the standard (not ad-hoc names)?
11. For Python, do public docstrings follow PEP 257's summary-line shape,
    without imposing non-native Google-style fields?
12. For TS/JS, do exported function docs cover every parameter and the native
    `@returns` / `@yields` contract when applicable?
13. For Rust, does every public unsafe item include `# Safety`, and does the
    crate enable the relevant native documentation lints?

If any check fails because information is **missing** (not wrong), the correct
action is to **flag it as "ask the author/user"**, not to propose guessed text.
