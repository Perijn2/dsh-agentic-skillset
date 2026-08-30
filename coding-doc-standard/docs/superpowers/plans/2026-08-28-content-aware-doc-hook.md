# Content-Aware Documentation Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the content proposed by DeepSeek Harness write and edit calls before they reach disk.

**Architecture:** The shell wrapper will construct an exact candidate from the hook payload and provide it to the Python checker through standard input. The checker will parse the documented JSON policy and check that candidate, while its direct-file CLI remains compatible. Package metadata and installer changes make that runtime available after npm installation.

**Tech Stack:** Node.js 18+, Bash, Python standard library, npm pack.

**Spec:** `docs/superpowers/specs/2026-08-28-content-aware-doc-hook-design.md`

## Global Constraints

- Do not write a target file merely to validate it.
- Block malformed, unsupported in-scope pre-write payloads with exit code 2 and actionable stderr.
- Preserve exit code 1 only for genuine checker infrastructure errors.
- Remain dependency-free at runtime.
- Keep direct `checker.py <file_path>` usage working.

---

### Task 1: Content-oriented checker and real policy loading

**Files:**
- Modify: `src/checker.py`
- Test: `scripts/test.mjs`

**Interfaces:**
- Consumes: a target path, optional JSON config path, and optional UTF-8 candidate on stdin.
- Produces: exit 0 for an allowed candidate, 2 for documented violations, 1 for unexpected infrastructure failure.

- [ ] **Step 1: Write failing configuration and stdin-candidate tests**

Add test cases that run `python3 src/checker.py path config` with a non-compliant file but `enabled: false`, and that run `python3 src/checker.py path` with compliant candidate content on stdin while the file is absent.

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm test`
Expected: configuration tests fail because the checker rejects the second positional argument; stdin candidate test fails because the checker reads only disk.

- [ ] **Step 3: Implement config loading and candidate input**

Add `load_config(path)` using `json`, merge validated values onto defaults, and use its values for scope, size, and placeholder decisions. Accept one required path plus one optional config path. If stdin is non-interactive and contains bytes, decode those as the candidate; otherwise read the target file.

- [ ] **Step 4: Run the tests to verify success**

Run: `npm test`
Expected: configuration and candidate cases pass.

### Task 2: Payload-aware pre-write wrapper

**Files:**
- Modify: `run-check.sh`
- Test: `scripts/test.mjs`

**Interfaces:**
- Consumes: hook JSON containing `tool_name` and `tool_input`.
- Produces: checker invocation with candidate content on stdin, or exit 2 for unsupported in-scope payloads.

- [ ] **Step 1: Write failing wrapper integration tests**

Add tests that pipe hook JSON for a new `write` containing non-compliant Python into `run-check.sh` and expect exit 2; a compliant write expects 0; a valid `edit` replacement that removes required docs expects 2; and a non-matching edit expects 2.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: wrapper tests fail because it passes only a path and the checker reports incorrect CLI usage.

- [ ] **Step 3: Implement candidate construction**

Use a small embedded Python JSON decoder in `run-check.sh` to identify the target and emit candidate bytes. Support write fields `content` and `contents`; support exact edit fields `old_string`/`new_string` and `oldText`/`newText`. Reject absent or ambiguous in-scope candidates with exit 2.

- [ ] **Step 4: Run tests to verify success**

Run: `npm test`
Expected: all wrapper integration tests pass without creating the new-file target.

### Task 3: Publishable package and reliable installer

**Files:**
- Modify: `package.json`
- Modify: `.npmignore`
- Modify: `scripts/install.mjs`
- Test: `scripts/test.mjs`

**Interfaces:**
- Consumes: `npm pack --dry-run --json` and an optional patch layer path.
- Produces: an archive containing the hook entry, checker, wrapper, and configuration; one installer write per destination.

- [ ] **Step 1: Write failing package-content test**

Add a test that invokes `npm pack --dry-run --json` with a temporary npm cache and asserts the packed files include `register-hooks.mjs` and exclude `src/__pycache__/checker.cpython-314.pyc`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`
Expected: package-content assertion fails because the current archive omits the hook entry and includes bytecode.

- [ ] **Step 3: Repair metadata and installer**

Point `main` and export default at `register-hooks.mjs`, include runtime files in `files`, add an ignore rule for bytecode, and remove the duplicated patch-layer write.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm pack --dry-run`
Expected: test matrix passes and archive contains every runtime artefact exactly once.
