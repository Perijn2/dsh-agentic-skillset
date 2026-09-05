# Rust Documentation Rules

Load this only for Rust. Apply `SKILL.md` first.

## Headers and public items

Use expanded `//!` inner-doc lines at the file top. Use `# Author`, `# Summary`,
`# Usage`, and optional `# Notes` headings for shared fields. `# Usage` contains
`## Core principle`, `## Setup`, `## Workflow`, `## API guide`, and `## Worked
example` wherever they apply, with a rustdoc-tested code block under Worked
example. Do not add `# Includes`; the Usage guide explains public APIs by task.
Use expanded consecutive `///` lines immediately above public items.

Do not require redundant Arguments or Returns headings: rustdoc renders the
signature and types. Public `unsafe` items need `# Safety`. Enforce `# Errors`
and `# Panics` with Clippy and known behavior; never guess either section.

## Layout and review

Never use a single-line required rustdoc comment. Use a blank `///` line
between the Summary and prose or every `#` heading, and between heading
sections. Missing `# Safety` for public unsafe items is a blocker; one-line
docs or missing heading separation are minor.
