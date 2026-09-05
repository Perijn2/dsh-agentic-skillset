# C and C++ Documentation Rules

Load this only for C or C++. Apply `SKILL.md` first.

## Headers and public APIs

Use expanded `/** ... */` Doxygen blocks. At the top of each file, place
`@file <name>` on its own line, then the shared Author, Summary, and Usage
fields. Usage must use the shared **Core principle**, **Setup**, **Workflow**,
**API guide**, and **Worked example** labels wherever they apply; put the
runnable example in `@code` / `@endcode`. Do not add an Includes list or a
surrogate `@details` API inventory. Public declarations need a non-empty
`@brief`.

Document every named parameter exactly once with `@param[in]`, `@param[out]`,
or `@param[in,out]`. Non-`void` APIs need an accurate `@return` or `@retval`.
Use `@throw`, `@code` / `@endcode`, and `@note` only for known errors,
examples, and notes.

## Layout

Never use a one-line Doxygen block. Put `@brief` on its own line and insert one
blank `*` line before each `@param`, `@return` / `@retval`, `@throw`, `@code`,
and `@note` group. Keep entries in one group adjacent; indent wrapped tag text.

## Review additions

Missing `@brief`, parameter direction, or required return documentation is a
blocker. One-line blocks or missing blank tag-group separation are minor.
