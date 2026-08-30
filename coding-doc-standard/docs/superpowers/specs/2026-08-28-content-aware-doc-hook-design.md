# Content-Aware Documentation Hook Design

## Goal

Enforce the documentation standard against the content a DeepSeek Harness tool
is about to write, while keeping the package configurable and installable.

## Architecture

The hook wrapper will decode the tool payload and create an in-memory candidate
for the requested path. A `write` candidate comes directly from the payload's
content field. An `edit` candidate is made by applying the requested exact
replacement to the current UTF-8 file. The wrapper will send the candidate on
standard input to the checker together with the path and optional config path.

The checker will expose a content-oriented CLI: `checker.py <path>
[config-path]`, reading candidate content from standard input when present and
reading the on-disk path only for its backwards-compatible direct-use mode. It
will load and validate the documented JSON policy, then make an allow/block
decision without depending on whether the target has already been written.

## Error Handling

For an in-scope target, an unsupported or malformed write/edit payload blocks
with a message explaining which field is required. A missing file for an edit,
an absent `old_string`, or a non-unique replacement also blocks. Explicitly
out-of-scope paths, disabled policy, excluded extensions, and configured skip
segments remain allowed. Internal checker failures retain exit code 1 so that
the bridge can distinguish an infrastructure failure from a policy violation.

## Packaging and Installation

The package export will point at the actual hook module and its `files` list
will include all runtime and installation artefacts. Generated Python bytecode
will be excluded. The installer will write each target once and preserve its
idempotent plugin-row behavior.

## Tests

The self-contained Node test matrix will cover checker configuration, stdin
candidate validation, new-file writes, edits that create compliant and
non-compliant candidates, malformed edits, wrapper integration, and the npm
pack file list. The current direct-file checker tests remain as compatibility
coverage.
