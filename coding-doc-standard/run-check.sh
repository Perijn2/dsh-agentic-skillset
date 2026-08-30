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
candidate_output="$(python3 -c '
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

checker_args=("${CHECKER}" "${file_path}")
if [ -n "${CONFIG_PATH}" ]; then
    checker_args+=("${CONFIG_PATH}")
fi
checker_args+=("--stdin")
python3 -c 'import base64, sys; sys.stdout.buffer.write(base64.b64decode(sys.argv[1]))' "${candidate_b64}" |
    python3 "${checker_args[@]}"
exit "${PIPESTATUS[1]}"
