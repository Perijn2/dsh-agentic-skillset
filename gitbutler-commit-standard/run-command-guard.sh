#!/usr/bin/env bash
# GitButler Commit Standard stdin wrapper.
# Runs the non-mutating Node command guard for each Harness shell request.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node --input-type=module -e '
import fs from "node:fs";
const { guardToolPayload } = await import(process.argv[1]);
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const result = guardToolPayload(payload);
if (result.stderr) process.stderr.write(result.stderr + "\n");
process.exit(result.exitCode);
' "${ROOT}/src/command-guard.mjs"
