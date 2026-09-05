# Python Documentation Rules

Load this only for Python. Apply `SKILL.md` first.

## Headers and public units

Use a multiline module docstring as the file's first statement. Use `Author:`,
`Summary:`, `Includes:`, `Usage:`, and optional `Notes:` for the shared fields.

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
