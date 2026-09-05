# TypeScript and JavaScript Documentation Rules

Load this only for TypeScript or JavaScript. Apply `SKILL.md` first.

## Headers and public units

Use an expanded leading `/** ... */` module block above the first export, with
`@module <name>` on its own line and the shared Author, Summary, and Usage
fields. Put the Usage guide in prose or one `@remarks` block, with **Core
principle**, **Setup**, **Workflow**, **API guide**, and **Worked example**
labels wherever they apply. Do not add an Includes inventory. Use expanded
`/** ... */` blocks directly above exported declarations.

Every exported parameter needs `@param`. Exported non-`void` TypeScript
functions need `@returns`; exported generators need `@yields`. Document only
known thrown errors with `@throws`. Use TSDoc `@param name - description` for
TypeScript; JavaScript may use JSDoc's optional `{type}` form.

## Layout and review

Never use a one-line JSDoc/TSDoc block. Put the Summary on its own line, then
one blank `*` line before each `@param`, `@returns`, `@yields`, `@throws`,
`@example`, or `@remarks` group. Missing required parameter, return, or yield
tags are blockers; one-line blocks or missing group separation are minor.
