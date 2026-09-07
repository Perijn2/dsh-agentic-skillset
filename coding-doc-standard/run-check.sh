#!/usr/bin/env bash
# stdin wrapper for the coding-doc-standard hook.
#
# The Claude Code hooks bridge (packages/hooks/hooks-claude-code) invokes the
# configured command with the PreToolUse payload on stdin. This wrapper extracts
# tool_input.file_path from that payload and pipes it to the checker.
#
# Exit codes (honored by the bridge):
#   0 = allow   2 = block (stderr = model feedback)   1 = internal error
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER="${HERE}/src/checker.py"

# The checker can run on the Python available in Git Bash. The pinned Ruff
# formatter is a native binary provisioned under the package root, so it needs
# no interpreter lookup of its own.
if command -v python3 >/dev/null 2>&1; then
    CHECKER_PYTHON=(python3)
elif command -v python >/dev/null 2>&1; then
    CHECKER_PYTHON=(python)
else
    echo "[doc-standard] Python 3 is required to validate pending writes." >&2
    exit 1
fi

# Resolve the config path: prefer the explicit env var, then the package-local
# config.json if it exists, else omit (checker falls back to built-in defaults).
CONFIG_PATH=""
if [ -n "${CODING_DOC_STANDARD_CONFIG:-}" ]; then
    CONFIG_PATH="${CODING_DOC_STANDARD_CONFIG}"
elif [ -f "${HERE}/config.json" ]; then
    CONFIG_PATH="${HERE}/config.json"
fi

# Build the *proposed* file in memory. A PreToolUse hook runs before the tool
# mutates disk, so checking the path itself would validate stale content (or
# nothing at all for a new file). The Python helper emits the path and a
# base64-encoded candidate on separate lines; base64 preserves all bytes,
# including trailing newlines, across Bash command substitution.
candidate_output="$("${CHECKER_PYTHON[@]}" -c '
import base64
import json
import os
import sys

def fail(message):
    print(f"[doc-standard] Cannot validate pending write: {message}", file=sys.stderr)
    raise SystemExit(2)

try:
    payload = json.load(sys.stdin)
except Exception:
    fail("hook payload is not valid JSON")

tool_input = payload.get("tool_input") or {}
if not isinstance(tool_input, dict):
    fail("tool_input must be an object")
path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("file")
if not isinstance(path, str) or not path:
    fail("tool_input.file_path is required")

tool_name = str(payload.get("tool_name") or payload.get("tool") or "").lower()
write_content = tool_input.get("content", tool_input.get("contents"))
old = tool_input.get("old_string", tool_input.get("oldText"))
new = tool_input.get("new_string", tool_input.get("newText"))

if tool_name == "write" or (write_content is not None and old is None):
    if not isinstance(write_content, str):
        fail("write tool_input.content must be a string")
    candidate = write_content
elif tool_name == "edit" or old is not None or new is not None:
    if not isinstance(old, str) or not isinstance(new, str):
        fail("edit requires string old_string and new_string fields")
    try:
        with open(path, "r", encoding="utf-8") as source:
            before = source.read()
    except OSError:
        fail("edit target cannot be read")
    matches = before.count(old)
    if matches != 1:
        fail(f"edit old_string must match exactly once (matched {matches})")
    candidate = before.replace(old, new, 1)
else:
    fail("unsupported tool payload; expected write content or edit replacement")

print(path)
print(base64.b64encode(candidate.encode("utf-8")).decode("ascii"))
' )" || exit $?
mapfile -t CANDIDATE_FIELDS <<< "${candidate_output}"

file_path="${CANDIDATE_FIELDS[0]:-}"
candidate_b64="${CANDIDATE_FIELDS[1]:-}"
if [ -z "${file_path}" ] || [ "${#CANDIDATE_FIELDS[@]}" -lt 2 ]; then
    echo "[doc-standard] Cannot validate pending write: candidate construction returned no content" >&2
    exit 2
fi

# Ruff receives the in-memory candidate, not the stale on-disk file. The hook
# runs the provisioned binary directly: Ruff's own lookup checks the active
# interpreter's script directory first, so a host-wide Ruff would otherwise win
# over the pin and make enforcement depend on an unpinned version.
if [[ "${file_path}" == *.py ]]; then
    RUFF_VERSION="0.16.6"
    RUFF_HOME="${HERE}/.tools/ruff-${RUFF_VERSION}"
    RUFF_BIN="${RUFF_HOME}/bin/ruff"
    if [ ! -x "${RUFF_BIN}" ] && [ -x "${RUFF_BIN}.exe" ]; then
        RUFF_BIN="${RUFF_BIN}.exe"
    fi
    if [ ! -x "${RUFF_BIN}" ]; then
        echo "[doc-standard] Pinned Ruff ${RUFF_VERSION} is unavailable at ${RUFF_HOME}. Run node scripts/install.mjs to provision it." >&2
        exit 1
    fi

    "${CHECKER_PYTHON[@]}" -c 'import base64, sys; sys.stdout.buffer.write(base64.b64decode(sys.argv[1]))' "${candidate_b64}" |
        "${RUFF_BIN}" format --check --stdin-filename "${file_path}" -
    ruff_status="${PIPESTATUS[1]}"
    if [ "${ruff_status}" -eq 1 ]; then
        echo "[doc-standard] Python code must be formatted with Ruff ${RUFF_VERSION}." >&2
        exit 2
    fi
    if [ "${ruff_status}" -ne 0 ]; then
        echo "[doc-standard] Pinned Ruff ${RUFF_VERSION} failed (exit ${ruff_status})." >&2
        exit 1
    fi
fi

checker_args=("${CHECKER}" "${file_path}")
if [ -n "${CONFIG_PATH}" ]; then
    checker_args+=("${CONFIG_PATH}")
fi
checker_args+=("--stdin")
"${CHECKER_PYTHON[@]}" -c 'import base64, sys; sys.stdout.buffer.write(base64.b64decode(sys.argv[1]))' "${candidate_b64}" |
    "${CHECKER_PYTHON[@]}" "${checker_args[@]}"
exit "${PIPESTATUS[1]}"
