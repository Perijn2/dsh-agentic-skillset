# Python Documentation Rules

Load this only for Python. Apply `SKILL.md` first.

## Headers and public units

Use a multiline module docstring as the file's first statement. Use `Author:`,
`Summary:`, `Usage:`, and optional `Notes:` for the shared fields. `Usage:` must
contain indented **Core principle**, **Setup**, **Workflow**, **API guide**, and
**Worked example** content wherever each applies. Do not add an `Includes:`
list; explain public APIs by task in Usage and retain declaration-level
contracts on public-unit docstrings.

Use a multiline triple-quoted docstring as the first statement of each public
function or class body. Follow PEP 257: the first line is a one-sentence
Summary ending in a period, followed by a blank docstring line before detail or
each populated labeled section. PEP 257 has no native `Args:`, `Returns:`, or
`Raises:` fields; do not invent them merely to match another language.

## Layout and review

Never use a one-line required docstring. Use exactly one blank docstring line
between the Summary and each populated section, keep section entries together,
and indent wrapped prose and examples consistently. Missing public docs are
blockers; one-line docs or missing summary/detail separation are minor.

## Formatting

Format every new or edited Python script and module with the skill-bundled,
pinned `ruff==0.16.6` formatter before considering work complete. Do not
hand-format as a substitute for running Ruff. Run `ruff format` on every
changed `.py` file, then run its non-mutating check:

```bash
RUFF="${HOME}/.dsh/node_modules/coding-doc-standard/.tools/ruff-0.16.6/bin/ruff"

"${RUFF}" format path/to/script.py
"${RUFF}" format --check path/to/script.py
```

Invoke the provisioned binary directly rather than `python -m ruff`: Ruff
resolves its own executable through the active interpreter's script directory,
where a host-wide Ruff would shadow the pin.

The PreToolUse hook blocks a Python write or edit whose pending content fails
that exact `ruff format --check`.
