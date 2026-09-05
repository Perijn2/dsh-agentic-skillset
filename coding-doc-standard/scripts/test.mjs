#!/usr/bin/env node
// Self-contained test matrix for the checker. Runs the Python checker against
// fixture files and asserts the exit code for each case.
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { inject, languageSettingsToExtensions } from "../register-hooks.mjs"

const CHECKER = new URL("../src/checker.py", import.meta.url).pathname
const tmp = mkdtempSync(join(tmpdir(), "coding-doc-"))

let passed = 0
let failed = 0

function assertEqual(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  _report(name, ok ? 0 : 1, 0)
}

// Settings page language switches map to every extension the checker supports.
assertEqual("settings: selected languages map to extensions",
  languageSettingsToExtensions({ python: true, typescriptJavascript: true, rust: false, cCpp: false }),
  [".py", ".ts", ".js", ".mjs", ".cjs"])
assertEqual("settings: no languages denies all extensions",
  languageSettingsToExtensions({ python: false, typescriptJavascript: false, rust: false, cCpp: false }), [])
assertEqual("plugin: declares required shell injection", inject, ["shell"])

function assertClientIncludes(name, expected) {
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  _report(name, client.includes(expected) ? 0 : 1, 0)
}

function assertClientExcludes(name, unexpected) {
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  _report(name, client.includes(unexpected) ? 1 : 0, 0)
}

assertClientIncludes('settings UI: registers a sidebar section', "settings.section")
assertClientExcludes('settings UI: does not use plugin configuration cards', "settings.plugin.item")
assertClientIncludes('settings UI: has the grouped settings styling', "cds-settings-group")
assertClientIncludes('settings UI: explains the documentation policy', "Enforces documentation requirements before code changes are written.")
assertClientIncludes('settings UI: marks only its settings navigation item for a custom icon', 'data-coding-doc-standard-settings-nav')
assertClientIncludes('settings UI: removes the navigation marker during disposal', 'removeAttribute(NAV_MARKER)')
assertClientIncludes('settings UI: replaces the fallback navigation icon through scoped CSS', '[data-coding-doc-standard-settings-nav]')

function check(name, content, ext, expected, configPath) {
  const path = join(tmp, `fixture${ext}`)
  writeFileSync(path, content)
  const args = [CHECKER, path]
  if (configPath) args.push(configPath)
  try {
    execFileSync("python3", args, { stdio: "pipe" })
    const code = 0
    const ok = code === expected
    passed += ok ? 1 : 0
    failed += ok ? 0 : 1
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (exit ${code}, expected ${expected})`)
  } catch (e) {
    const code = e.status ?? 1
    const ok = code === expected
    passed += ok ? 1 : 0
    failed += ok ? 0 : 1
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (exit ${code}, expected ${expected})`)
  }
}

function checkCandidate(name, path, content, expected, configPath) {
  try {
    execFileSync("bash", ["-c",
      'printf %s "$1" | python3 "$2" "$3" "$4" --stdin',
      "checker-test", content, CHECKER, path, configPath ?? ""], { stdio: "pipe" })
    _report(name, 0, expected)
  } catch (error) {
    _report(name, error.status ?? 1, expected)
  }
}

function checkHook(name, payload, expected) {
  const wrapper = new URL("../run-check.sh", import.meta.url).pathname
  try {
    execFileSync("bash", ["-c", 'printf %s "$1" | bash "$2"',
      "hook-test", JSON.stringify(payload), wrapper], { stdio: "pipe" })
    _report(name, 0, expected)
  } catch (error) {
    _report(name, error.status ?? 1, expected)
  }
}

// --- Python (file header = module docstring; unit doc precedes each unit) ---
check("py: good",
`"""Helper module.

Author: Jane Doe
Includes: foo
Usage:
    foo(1)
"""
def foo(x):
    """Double the value."""
    return x * 2
`, ".py", 0)
check("py: public summary must end with a period",
`"""Helper module.

Author: Jane Doe
Includes: foo
Usage:
    foo(1)
"""
def foo(x):
    """Double the value"""
    return x * 2
`, ".py", 2)
check("py: multi-line public docs need a summary separator",
`"""Helper module.

Author: Jane Doe
Includes: foo
Usage:
    foo(1)
"""
def foo(x):
    """Double the value.
    This is extra detail without a separating blank line.
    """
    return x * 2
`, ".py", 2)
check("py: no header", "def foo(x):\n    return x\n", ".py", 2)
check("py: guessed author",
`"""Author: TODO
Summary: helper
Includes: foo
Usage:
    foo(1)
"""
def foo(x):
    """Doubles the input.

    Returns:
        The doubled value.
    """
    return x
`, ".py", 2)
check("py: missing usage",
`"""Author: Jane Doe
Summary: helper
Includes: foo
"""
def foo(x):
    """Author: Jane Doe
    Summary: doubles
    Includes: foo
    """
    return x
`, ".py", 2)

// --- TypeScript (file header = leading /**; unit doc = a SECOND /** block immediately above the declaration) ---
check("ts: good",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * @remarks
 * Includes:
 *   - helper: a helper function.
 *
 * Usage:
 *   import { helper } from "./example";
 *   helper("ok");
 */
/**
 * Run the example helper.
 *
 * @param value - The value to return.
 * @returns A success message.
 *
 * @example
 * const msg = helper();
 */
export function helper(value: string): string {
    return value;
}
`, ".ts", 0)
check("ts: no header", "export function foo(x) {\n    return x\n}\n", ".ts", 2)
check("ts: missing unit doc",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * @remarks
 * Includes:
 *   - helper: a helper function.
 *
 * Usage:
 *   import { helper } from "./example";
 */
export function helper(): string {
    return "ok";
}
`, ".ts", 2)
check("ts: exported parameters require TSDoc @param tags",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * Includes:
 *   - helper: a helper function.
 *
 * Usage:
 *   import { helper } from "./example";
 */
/**
 * Return the supplied value.
 *
 * @returns The supplied value.
 */
export function helper(value: string): string {
    return value;
}
`, ".ts", 2)
check("ts: exported values require TSDoc @returns",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * Includes:
 *   - helper: a helper function.
 *
 * Usage:
 *   import { helper } from "./example";
 */
/**
 * Return the supplied value.
 *
 * @param value - The value to return.
 */
export function helper(value: string): string {
    return value;
}
`, ".ts", 2)
check("js: exported return values require JSDoc @returns",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * Includes:
 *   - helper: a helper function.
 *
 * Usage:
 *   import { helper } from "./example";
 */
/**
 * Return the supplied value.
 *
 * @param value - The value to return.
 */
export function helper(value) {
    return value;
}
`, ".js", 2)
check("js: exported generator functions require @yields",
`/**
 * @module example
 * @author Jane Doe
 * Example helper module.
 *
 * Includes:
 *   - values: a generator.
 *
 * Usage:
 *   import { values } from "./example";
 */
/**
 * Yield an example value.
 */
export function* values() {
    yield "ok";
}
`, ".js", 2)

// --- Rust (file header = //! at top; unit doc = /// preceding item) ---
check("rs: good",
`//! # Author: Jane Doe
//! # Summary: helpers
//! # Includes: foo
//! # Examples
//! let x = foo(2);
/// # Author: Jane Doe
/// # Summary: doubles
/// # Includes: foo
/// # Examples
/// let x = foo(2);
pub fn foo(x: i32) -> i32 { x * 2 }
`, ".rs", 0)
check("rs: no header", "pub fn foo(x: i32) -> i32 { x * 2 }\n", ".rs", 2)
check("rs: public unsafe functions require a Safety section",
`//! # Author: Jane Doe
//! # Summary: helpers
//! # Includes: read_byte
//! # Examples
//! let value = unsafe { read_byte(std::ptr::null()) };
/// Read a byte from a raw pointer.
pub unsafe fn read_byte(ptr: *const u8) -> u8 { *ptr }
`, ".rs", 2)
check("rs: public unsafe functions with a Safety section are allowed",
`//! # Author: Jane Doe
//! # Summary: helpers
//! # Includes: read_byte
//! # Examples
//! let value = unsafe { read_byte(std::ptr::null()) };
/// Read a byte from a raw pointer.
///
/// # Safety
/// The caller must provide a non-null, valid pointer to initialized memory.
pub unsafe fn read_byte(ptr: *const u8) -> u8 { *ptr }
`, ".rs", 0)

// --- C/C++ (Doxygen file and API documentation) ---
const cHeader = `/**
 * @file api.h
 * @author Jane Doe
 * @brief Example public API.
 *
 * @details
 * Includes:
 *   - transform: transforms input into an output buffer.
 *
 * @code
 * char output[16];
 * transform("ok", output);
 * @endcode
 */
`
const cApiDoc = `/**
 * @brief Transform input into an output buffer.
 *
 * @param[in] input Source text to transform.
 * @param[out] output Destination buffer for the transformed text.
 * @return Zero on success; a non-zero error code on failure.
 */
int transform(const char *input, char *output);
`
check("c: good API documentation", cHeader + cApiDoc, ".h", 0)
check("c: missing @brief is blocked", cHeader.replace(" * @brief Example public API.\n", "") + cApiDoc, ".h", 2)
check("c: malformed @brief tag is blocked", cHeader.replace("@brief Example", "@briefly Example") + cApiDoc, ".h", 2)
check("c: missing parameter direction is blocked", cHeader + cApiDoc.replace("@param[in] input", "@param input"), ".h", 2)
check("c: invalid parameter direction is blocked", cHeader + cApiDoc.replace("@param[out] output", "@param[inout] output"), ".h", 2)
check("c: multiple parameter directions are blocked", cHeader + cApiDoc.replace(
  " * @param[in] input Source text to transform.\n",
  " * @param[in] input Source text to transform.\n * @param[out] input Destination buffer for the transformed text.\n"), ".h", 2)
check("c: missing return documentation is blocked", cHeader + cApiDoc.replace(" * @return Zero on success; a non-zero error code on failure.\n", ""), ".h", 2)

// --- Out of scope (write into a node_modules path segment) ---
function checkInSubdir(name, rel, content, ext, expected, configPath) {
  const dir = join(tmp, rel.split("/")[0])
  try { mkdirSync(dir, { recursive: true }) } catch {}
  const path = join(dir, rel.split("/").slice(-1)[0])
  writeFileSync(path, content)
  const args = [CHECKER, path]
  if (configPath) args.push(configPath)
  try {
    execFileSync("python3", args, { stdio: "pipe" })
    _report(name, 0, expected)
  } catch (e) {
    _report(name, e.status ?? 1, expected)
  }
}
function _report(name, code, expected) {
  const ok = code === expected
  passed += ok ? 1 : 0
  failed += ok ? 0 : 1
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (exit ${code}, expected ${expected})`)
}
checkInSubdir("py: out of scope (node_modules)", "node_modules/pkg/mod.py", "def foo():\n    pass\n", ".py", 0)

// --- Empty / stub ---
check("py: empty file", "", ".py", 0)
check("py: stub (small, no units)", "x = 1\n", ".py", 0)

// ---------------------------------------------------------------------------
// New test cases for config-driven policy
// ---------------------------------------------------------------------------

// (1) checker with a config file that excludes an extension (file with that extension → exit 0)
const configExcludeExt = join(tmp, "config-exclude-ext.json")
writeFileSync(configExcludeExt, JSON.stringify({
  enabled: true,
  includeExtensions: [".ts"],
  excludeExtensions: [".py"],
  skipSegments: [],
  minFileSize: 1,
  placeholderAuthors: [],
  timeoutMs: 10000
}))
check("config: exclude extension blocks .py", "def foo(x):\n    return x\n", ".py", 0, configExcludeExt)

// (2) checker with enabled:false (non-compliant file → exit 0)
const configDisabled = join(tmp, "config-disabled.json")
writeFileSync(configDisabled, JSON.stringify({
  enabled: false,
  includeExtensions: [".py"],
  excludeExtensions: [],
  skipSegments: [],
  minFileSize: 1,
  placeholderAuthors: [],
  timeoutMs: 10000
}))
check("config: enabled=false allows non-compliant file", "def foo(x):\n    return x\n", ".py", 0, configDisabled)

// (3) checker with a custom skipSegment (file under that segment → exit 0)
const configCustomSkip = join(tmp, "config-custom-skip.json")
writeFileSync(configCustomSkip, JSON.stringify({
  enabled: true,
  includeExtensions: [".py"],
  excludeExtensions: [],
  skipSegments: [".git", "node_modules", "vendor", "target", "dist", "build", "__pycache__", "custom_skip_dir"],
  minFileSize: 1,
  placeholderAuthors: [],
  timeoutMs: 10000
}))
checkInSubdir("config: custom skipSegment", "custom_skip_dir/foo.py", "def foo(x):\n    return x\n", ".py", 0, configCustomSkip)

// (4) checker with a malformed config file (falls back to defaults → non-compliant file still exit 2)
const configMalformed = join(tmp, "config-malformed.json")
writeFileSync(configMalformed, "{ this is not valid json !!!")
check("config: malformed config falls back to defaults", "def foo(x):\n    return x\n", ".py", 2, configMalformed)

// (5) a committed project policy ignores matching paths relative to its root.
const projectIgnoreRoot = join(tmp, "project-ignore")
mkdirSync(projectIgnoreRoot, { recursive: true })
writeFileSync(join(projectIgnoreRoot, ".coding-doc-standard-ignore"),
  "# Pre-existing code\nlegacy-library/**\n\n")
checkCandidate("project config: matching file is ignored", join(projectIgnoreRoot, "legacy-library", "module.py"),
  "def legacy_api():\n    pass\n", 0)
checkCandidate("project config: non-matching file remains enforced", join(projectIgnoreRoot, "src", "module.py"),
  "def public_api():\n    pass\n", 2)

// (6) candidate content is checked before its target exists.
const candidatePath = join(tmp, "new-module.py")
checkCandidate("candidate: compliant new file", candidatePath,
`"""Module.\n\nAuthor: Jane Doe\nIncludes:\n    foo: Does work.\nUsage:\n    foo()\n"""\n\ndef foo():\n    """Do work."""\n`, 0)
checkCandidate("candidate: non-compliant new file", candidatePath, "def foo():\n    pass\n", 2)

// (6) wrapper checks the pending write, not the on-disk target.
checkHook("hook: blocks non-compliant write", {
  tool_name: "write",
  tool_input: { file_path: join(tmp, "hook-new.py"), content: "def foo():\n    pass\n" },
}, 2)
checkHook("hook: allows compliant write", {
  tool_name: "write",
  tool_input: { file_path: join(tmp, "hook-good.py"), content:
`"""Module.\n\nAuthor: Jane Doe\nIncludes:\n    foo: Does work.\nUsage:\n    foo()\n"""\n\ndef foo():\n    """Do work."""\n` },
}, 0)

const editablePath = join(tmp, "editable.py")
writeFileSync(editablePath,
`"""Module.\n\nAuthor: Jane Doe\nIncludes:\n    foo: Does work.\nUsage:\n    foo()\n"""\n\ndef foo():\n    """Do work."""\n`)
checkHook("hook: blocks edit that removes docs", {
  tool_name: "edit",
  tool_input: { file_path: editablePath, old_string: '"""Do work."""', new_string: "pass" },
}, 2)
checkHook("hook: blocks unmatched edit", {
  tool_name: "edit",
  tool_input: { file_path: editablePath, old_string: "missing", new_string: "pass" },
}, 2)

// (7) published archives must contain the runtime hook and no generated bytecode.
try {
  const packageRoot = new URL("..", import.meta.url).pathname
  const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, NPM_CONFIG_CACHE: join(tmp, "npm-cache") },
  }))
  const packageInfo = Array.isArray(packed) ? packed[0] : Object.values(packed)[0]
  const packedPaths = new Set(packageInfo.files.map((file) => file.path))
  const archiveIsValid = packedPaths.has("register-hooks.mjs") &&
    packedPaths.has("client.js") &&
    ![...packedPaths].some((path) => path.includes("__pycache__") || path.endsWith(".pyc"))
  _report("package: includes hook entry and excludes bytecode", archiveIsValid ? 0 : 1, 0)
} catch (error) {
  _report("package: includes hook entry and excludes bytecode", error.status ?? 1, 0)
}

rmSync(tmp, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
