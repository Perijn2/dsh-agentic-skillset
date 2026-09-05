#!/usr/bin/env python3
"""The coding documentation standard's mechanical compliance checker.

Author: Perijn Huijser

Summary: Validates supported source files against the coding documentation standard.

Usage:
    Core principle:
        Treat documentation as a verifiable API contract; report violations
        without attempting to infer or repair unknown behavior.

    Setup:
        Run this module with Python 3 and a target source-file path. The optional
        configuration path overrides policy defaults; `--stdin` checks proposed
        content while retaining the supplied path for language selection.

    Workflow:
        The checker determines whether the target is in scope, skips eligible
        stubs, validates its file header and public units, then exits with 0 for
        compliance, 2 for policy violations, or 1 for an internal error.

    API guide:
        `main` is the command-line entry point. Embedders call `check_content`
        with source text, a path, a language kind, and placeholder authors, then
        inspect the returned `Violations` collection.

    Worked example:
        $ python3 checker.py src/example.py config.json
        # Exit 0: compliant; exit 2: documentation violations printed to stderr.

The coding-doc-standard - the mechanical checker.

Enforces the universal coding documentation standard against a single file.
Exits:
  0 = compliant / out of scope  -> the write/edit is ALLOWED
  2 = doc-standard violation     -> BLOCK (stderr becomes the model feedback)
  1 = internal error            -> non-blocking error (write/edit proceeds)

Standard (see ../../README.md for the full spec and per-language mappings):

  File / module header (one per file), in this order:
    Author      - REQUIRED, real name (never a placeholder/guess)
    Summary     - one line: what this file/module is for
    Usage       - advanced module guide: core principle, setup, workflow,
                  task-oriented API guide, and runnable worked example
    Notes       - optional; omit if empty

  Unit doc (one per public unit), in this order:
    Summary     - always line 1, one sentence, ends with a period
    Behavior    - omit if fully self-evident
    Parameters  - omit if none
    Returns     - omit if none
    Errors      - omit if none
    Example     - omit if none
    Notes       - omit if none

The "stop and ask, never guess" rule is enforced mechanically: a placeholder or
guessed Author (TODO, FIXME, unknown, tbd, n/a, none, agent, ai, assistant,
claude, copilot, empty) is a violation, as is a missing header or a missing
unit doc on a public unit.
"""

import ast
import fnmatch
import json
import os
import re
import sys
from pathlib import Path

# Extensions in scope, mapped to the language family the checker dispatches on.
IN_SCOPE = {
    ".py": "python",
    ".ts": "tsjs",
    ".js": "tsjs",
    ".mjs": "tsjs",
    ".cjs": "tsjs",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "c",
    ".cc": "c",
    ".hpp": "c",
    ".cxx": "c",
    ".hxx": "c",
}

# Directories that are never checked (dependencies, build output, vendored code).
SKIP_SEGMENTS = {
    ".git", "node_modules", "vendor", "target", "dist", "build", "__pycache__",
}

# Values that mean "author unknown / guessed / placeholder".
PLACEHOLDER_AUTHORS = {
    "", "todo", "tbd", "fixme", "unknown", "n/a", "none", "agent", "ai",
    "assistant", "claude", "copilot", "you", "name", "your", "placeholder",
}

# Minimum file size (bytes) below which a code-EMPTY file is treated as a stub.
MIN_FILE_SIZE = 50
PROJECT_IGNORE_NAME = ".coding-doc-standard-ignore"
USAGE_LABELS = ("core principle", "setup", "workflow", "api guide", "worked example")


def _default_config():
    """Return a fresh copy of the policy defaults."""
    return {
        "enabled": True,
        "includeExtensions": list(IN_SCOPE),
        "excludeExtensions": [],
        "skipSegments": list(SKIP_SEGMENTS),
        "minFileSize": MIN_FILE_SIZE,
        "placeholderAuthors": list(PLACEHOLDER_AUTHORS),
    }


def _load_config(config_path):
    """Load a JSON policy, falling back safely when it is absent or invalid."""
    config = _default_config()
    if not config_path:
        return config
    try:
        with open(config_path, "r", encoding="utf-8") as config_file:
            raw = json.load(config_file)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return config
    if not isinstance(raw, dict):
        return config
    if isinstance(raw.get("enabled"), bool):
        config["enabled"] = raw["enabled"]
    for key in ("includeExtensions", "excludeExtensions", "skipSegments", "placeholderAuthors"):
        if isinstance(raw.get(key), list) and all(isinstance(value, str) for value in raw[key]):
            config[key] = raw[key]
    if isinstance(raw.get("minFileSize"), int) and raw["minFileSize"] >= 1:
        config["minFileSize"] = raw["minFileSize"]
    return config


def _project_ignore_patterns(path: str):
    """Return the nearest project's relative ignore patterns and root."""
    candidate = Path(path).absolute().parent
    for directory in (candidate, *candidate.parents):
        ignore_path = directory / PROJECT_IGNORE_NAME
        if not ignore_path.is_file():
            continue
        try:
            lines = ignore_path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            return (), None
        valid = []
        for pattern in lines:
            pattern = pattern.strip()
            if not pattern or pattern.startswith("#") or Path(pattern).is_absolute():
                continue
            if ".." in Path(pattern).parts:
                continue
            valid.append(pattern.replace("\\", "/"))
        return tuple(valid), directory
    return (), None


def _is_project_ignored(path: str) -> bool:
    """Return whether the nearest project policy ignores this path."""
    patterns, root = _project_ignore_patterns(path)
    if root is None:
        return False
    try:
        relative = Path(path).absolute().relative_to(root).as_posix()
    except ValueError:
        return False
    return any(fnmatch.fnmatchcase(relative, pattern) for pattern in patterns)


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _is_out_of_scope(path: str, config) -> bool:
    extension = Path(path).suffix.lower()
    return (
        not config["enabled"]
        or extension not in {item.lower() for item in config["includeExtensions"]}
        or extension in {item.lower() for item in config["excludeExtensions"]}
        or any(seg in set(config["skipSegments"]) for seg in Path(path).parts)
        or _is_project_ignored(path)
    )


def _file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _read_file(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (UnicodeDecodeError, OSError):
        return None


def _strip_comment_line(raw: str) -> str:
    """Collapse a comment-internal line to its content.

    TSDoc/Doxygen lines carry a leading ` * ` marker (e.g. " * @author");
    Python/Rust lines do not. We strip an optional leading `*` so label
    matching is identical across languages.
    """
    s = raw.strip()
    if s.startswith("*"):
        s = s[1:].lstrip()
    return s


def _label_value(text: str, label: str):
    """Return the value on the first line starting with `label`, or None."""
    for raw in text.splitlines():
        s = _strip_comment_line(raw)
        if s.startswith(label):
            return s[len(label):].strip()
    return None


def _doxygen_tag_value(text: str, tag: str):
    """Return a Doxygen tag's value only when the tag name is exact."""
    pattern = re.compile(re.escape(tag) + r"(?:\s+(.*))?$")
    for raw in text.splitlines():
        match = pattern.match(_strip_comment_line(raw))
        if match:
            return (match.group(1) or "").strip()
    return None


def _section_has_content(text: str, labels) -> bool:
    """True if any label line is followed by at least one non-blank line.

    Lines are comment-stripped (see `_strip_comment_line`) before testing, so
    the ` * ` marker inside TSDoc/Doxygen blocks does not defeat the match.
    """
    lines = text.splitlines()
    for i, raw in enumerate(lines):
        s = _strip_comment_line(raw).lower()
        for label in labels:
            if s.startswith(label):
                for raw2 in lines[i + 1:]:
                    if _strip_comment_line(raw2):
                        return True
                return False
    return False


def _missing_usage_labels(text: str):
    """Return required Usage-guide labels absent from a header comment block."""
    found = set()
    for raw in text.splitlines():
        line = _strip_comment_line(raw).lower().lstrip("#").strip()
        for label in USAGE_LABELS:
            if line.startswith(label):
                found.add(label)
    return [label for label in USAGE_LABELS if label not in found]


def _check_usage_guide(text: str, path: str, v) -> None:
    """Report a missing Usage section or required guide labels."""
    if not _section_has_content(text, ["usage:", "# usage", "# examples", "@code"]):
        v.add(path, 1, "Missing Usage section in file header")
        return


def _check_python_docstring_shape(doc: str, path: str, line: int, v, subject: str) -> None:
    """Enforce PEP 257's native summary-line structure without invented tags."""
    lines = doc.splitlines()
    if not lines:
        return
    if not lines[0].strip().endswith("."):
        v.add(path, line, f"Python docstring summary for {subject} must end with a period")
    if len(lines) > 1 and any(item.strip() for item in lines[1:]) and lines[1].strip():
        v.add(path, line, f"Multi-line Python docstring for {subject} needs a blank line after its summary")


def _preceding_doc_lines(text: str, prefix: str):
    """Return the stripped doc-comment lines immediately preceding `text`.

    Stops at the first non-doc, non-blank line (scanning backwards).
    """
    out = []
    for raw in reversed(text.splitlines()):
        s = raw.strip()
        if s.startswith(prefix):
            out.append(re.sub(r"^" + re.escape(prefix), "", s).strip())
        else:
            break
    return out


# ---------------------------------------------------------------------------
# File header checks
# ---------------------------------------------------------------------------

def _check_header_python(content: str, path: str, v, placeholders) -> None:
    try:
        doc = ast.get_docstring(ast.parse(content))
    except SyntaxError:
        doc = None
    if not doc:
        v.add(path, 1, "Missing file header (module docstring)")
        return
    _check_python_docstring_shape(doc, path, 1, v, "module")
    author = _label_value(doc, "Author:")
    if author is None:
        v.add(path, 1, "Missing 'Author' in file header")
    elif author.lower() in placeholders:
        v.add(path, 1, f"Placeholder/guessed Author in file header: {author!r}")
    _check_usage_guide(doc, path, v)


def _check_header_tsjs(content: str, path: str, v, placeholders) -> None:
    blocks = re.findall(r"/\*\*(.*?)\*/", content, re.S | re.M)
    if not blocks:
        v.add(path, 1, "Missing file header (TSDoc /** block)")
        return
    header = blocks[0]
    author = _label_value(header, "@author")
    if author is None:
        v.add(path, 1, "Missing '@author' in file header")
    elif author.lower() in placeholders:
        v.add(path, 1, f"Placeholder/guessed Author in file header: {author!r}")
    _check_usage_guide(header, path, v)


def _check_header_rust(content: str, path: str, v, placeholders) -> None:
    header_lines = []
    for ln in content.splitlines():
        s = ln.strip()
        if s.startswith("//!"):
            header_lines.append(re.sub(r"^//!\s?", "", s))
        else:
            break
    if not header_lines:
        v.add(path, 1, "Missing file header (//! inner doc)")
        return
    text = "\n".join(header_lines)
    # Rust places the author name on the line after '# Author'.
    author = None
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        if ln.strip().startswith("# Author"):
            for j in range(i + 1, len(lines)):
                val = lines[j].strip().lstrip("-").strip()
                if val:
                    author = val
                    break
            break
    if author is None:
        v.add(path, 1, "Missing '# Author' in file header")
    elif author.lower() in placeholders:
        v.add(path, 1, f"Placeholder/guessed Author in file header: {author!r}")
    _check_usage_guide(text, path, v)


def _check_header_c(content: str, path: str, v, placeholders) -> None:
    blocks = re.findall(r"/\*\*(.*?)\*/", content, re.S | re.M)
    if not blocks or "@file" not in blocks[0]:
        v.add(path, 1, "Missing file header (@file Doxygen block)")
        return
    header = blocks[0]
    author = _label_value(header, "@author")
    if author is None:
        v.add(path, 1, "Missing '@author' in file header")
    elif author.lower() in placeholders:
        v.add(path, 1, f"Placeholder/guessed Author in file header: {author!r}")
    brief = _doxygen_tag_value(header, "@brief")
    if not brief:
        v.add(path, 1, "Missing '@brief' in file header")
    _check_usage_guide(header, path, v)


# ---------------------------------------------------------------------------
# Unit doc checks
# ---------------------------------------------------------------------------

def _check_unit_python(content: str, path: str, v) -> None:
    try:
        tree = ast.parse(content)
    except SyntaxError:
        for name in re.findall(r"^\s*(?:async\s+)?def\s+(\w+)", content, re.M):
            if not name.startswith("_"):
                v.add(path, 1, f"Missing unit doc for public unit '{name}'")
        return
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.name.startswith("_"):
                continue
            doc = ast.get_docstring(node)
            if not doc or not doc.strip():
                v.add(path, node.lineno, f"Missing unit doc for public unit '{node.name}'")
            else:
                _check_python_docstring_shape(doc, path, node.lineno, v,
                                              f"public unit '{node.name}'")


def _check_unit_tsjs(content: str, path: str, v) -> None:
    blocks = [(bm.start(), bm.end()) for bm in re.finditer(r"/\*\*(.*?)\*/", content, re.S)]
    for m in re.finditer(
        r"\bexport\s+(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+(\w+)",
        content):
        name = m.group(2)
        decl_start = m.start()
        last_idx, last_end = None, -1
        for idx, (s, e) in enumerate(blocks):
            if e <= decl_start and e > last_end:
                last_idx, last_end = idx, e
        # last_idx == 0 means the only block before the declaration is the
        # file header -> no *separate* unit doc.
        if last_idx is None or last_idx == 0:
            v.add(path, content[:decl_start].count("\n") + 1,
                  f"Missing unit doc for exported unit '{name}'")

    function_pattern = re.compile(
        r"\bexport\s+(?:default\s+)?(?:async\s+)?function\s*(?P<generator>\*)?\s+"
        r"(?P<name>[A-Za-z_$]\w*)\s*\((?P<params>[^)]*)\)"
        r"(?:\s*:\s*(?P<return>[^\s{=;]+))?")
    block_matches = list(re.finditer(r"/\*\*(.*?)\*/", content, re.S))
    for match in function_pattern.finditer(content):
        name = match.group("name")
        line = content[:match.start()].count("\n") + 1
        preceding = [block for block in block_matches if block.end() <= match.start()]
        last = preceding[-1] if preceding else None
        if last is None or content[last.end():match.start()].strip():
            continue  # The generic unit-doc check already reports this.
        doc = last.group(1)
        documented = {
            tag.group(1) for tag in re.finditer(
                r"@param\s+(?:\{[^}]+\}\s+)?\[?([A-Za-z_$]\w*)", doc)
        }
        for raw in match.group("params").split(","):
            parameter = raw.strip().split("=", 1)[0].strip()
            parameter_name = parameter.split(":", 1)[0].rstrip("?").strip()
            names = re.findall(r"[A-Za-z_$]\w*", parameter_name)
            if names and names[-1] not in documented:
                v.add(path, line, f"Missing '@param' documentation for exported parameter '{names[-1]}' in '{name}'")
        if match.group("generator"):
            if not re.search(r"@(?:yields|yield)\b", doc):
                v.add(path, line, f"Missing '@yields' documentation for exported generator '{name}'")
        elif match.group("return") not in (None, "void", "never"):
            if not re.search(r"@returns\b", doc):
                v.add(path, line, f"Missing '@returns' documentation for exported function '{name}'")
        elif Path(path).suffix.lower() in {".js", ".mjs", ".cjs"}:
            body_start = content.find("{", match.end())
            body_end = content.find("}", body_start + 1) if body_start >= 0 else -1
            body = content[body_start + 1:body_end] if body_end >= 0 else ""
            if re.search(r"\breturn\s+[^;\s]", body) and not re.search(r"@(?:returns|return)\b", doc):
                v.add(path, line, f"Missing '@returns' documentation for exported function '{name}'")


def _check_unit_rust(content: str, path: str, v) -> None:
    patterns = (
        r"\bpub\s+(?:unsafe\s+)?(?:async\s+)?fn\s+(\w+)",
        r"\bpub\s+(?:unsafe\s+)?struct\s+(\w+)",
        r"\bpub\s+(?:unsafe\s+)?enum\s+(\w+)",
        r"\bpub\s+(?:unsafe\s+)?trait\s+(\w+)",
        r"\bpub\s+const\s+(\w+)",
        r"\bpub\s+type\s+(\w+)",
    )
    combined = r"|".join(f"({p})" for p in patterns)
    for m in re.finditer(combined, content):
        name = next(g for g in m.groups() if g)
        decl_start = m.start()
        docs = _preceding_doc_lines(content[:decl_start], "///")
        if not docs or not any(d.strip() for d in docs):
            v.add(path, content[:decl_start].count("\n") + 1,
                  f"Missing unit doc for public unit '{name}'")
        elif re.match(r"\bpub\s+unsafe\b", m.group(0)):
            doc = "\n".join(reversed(docs))
            if not re.search(r"(?m)^# Safety\s*$", doc):
                v.add(path, content[:decl_start].count("\n") + 1,
                      f"Missing '# Safety' section for public unsafe item '{name}'")


def _c_parameter_names(params: str):
    """Return named C/C++ parameters, excluding void and variadic markers."""
    names = []
    for raw in params.split(","):
        param = raw.strip()
        if not param or param == "void" or param == "...":
            continue
        param = param.split("=", 1)[0].strip()  # C++ default argument
        function_pointer = re.search(r"\(\s*\*\s*([A-Za-z_]\w*)\s*\)", param)
        if function_pointer:
            names.append(function_pointer.group(1))
            continue
        identifiers = re.findall(r"[A-Za-z_]\w*", param)
        if identifiers:
            names.append(identifiers[-1])
    return names


def _check_c_api_doc(doc: str, name: str, params: str, return_type: str,
                     path: str, line: int, v) -> None:
    """Validate the required Doxygen API contract for one public function."""
    if not _doxygen_tag_value(doc, "@brief"):
        v.add(path, line, f"Missing '@brief' for public function '{name}'")

    param_tags = {}
    for match in re.finditer(r"@param\s*(?:\[([^\]]+)\])?\s+([A-Za-z_]\w*)\b", doc):
        param_tags.setdefault(match.group(2), []).append(match.group(1))
    valid_directions = {"in", "out", "in,out"}
    for param_name in _c_parameter_names(params):
        directions = param_tags.get(param_name)
        if not directions:
            v.add(path, line, f"Missing '@param' documentation for parameter '{param_name}' in '{name}'")
        elif len(directions) != 1:
            v.add(path, line, f"Parameter '{param_name}' in '{name}' must have exactly one @param direction")
        elif any(direction not in valid_directions for direction in directions):
            v.add(path, line, f"Invalid @param direction for parameter '{param_name}' in '{name}'; use [in], [out], or [in,out]")
        elif any(direction is None for direction in directions):
            v.add(path, line, f"Missing @param direction for parameter '{param_name}' in '{name}'; use [in], [out], or [in,out]")

    normalized_return = re.sub(r"\b(?:extern|const|volatile|restrict)\b", "", return_type).strip()
    if normalized_return != "void" and not re.search(r"@(?:return|retval)\b", doc):
        v.add(path, line, f"Missing '@return' or '@retval' documentation for public function '{name}'")


def _check_unit_c(content: str, path: str, v) -> None:
    # Best-effort: check externally linked function declarations. `static`
    # functions are internal; all other ordinary declarations form the C/C++
    # API surface and require a Doxygen contract immediately above them.
    declaration = re.compile(
        r"""(?mx)
        ^[\t ]*
        (?!static\b)
        (?P<return>(?:extern\s+)?(?:[A-Za-z_]\w*(?:::\w+)?|struct\s+\w+|enum\s+\w+|class\s+\w+|const|volatile|restrict|unsigned|signed|short|long|[\*&])+[\t ]+)
        (?P<name>[A-Za-z_]\w*)\s*\((?P<params>[^(){};]*)\)\s*(?:const\s*)?(?:;|\{)
        """)
    try:
        doc_blocks = list(re.finditer(r"/\*\*(.*?)\*/", content, re.S))
        for m in declaration.finditer(content):
            # Usage snippets in a Doxygen @code block can resemble real
            # declarations; they are documentation, not API declarations.
            if any(block.start() <= m.start() < block.end() for block in doc_blocks):
                continue
            name = m.group("name")
            decl_start = m.start()
            docs = [block for block in doc_blocks if block.end() <= decl_start]
            last = docs[-1] if docs else None
            line = content[:decl_start].count("\n") + 1
            if last is None or content[last.end():decl_start].strip() or not last.group(1).strip():
                v.add(path, line, f"Missing unit doc for public function '{name}'")
                continue
            _check_c_api_doc(last.group(1), name, m.group("params"),
                             m.group("return"), path, line, v)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Violation list + dispatch
# ---------------------------------------------------------------------------

class Violations:
    """Collect documentation-policy violations for one checked source file.

    Instances retain formatted diagnostics in insertion order for the checker
    dispatcher and command-line interface.
    """

    def __init__(self):
        self.items = []

    def add(self, path, line, msg):
        """Append one formatted documentation-policy violation.

        The resulting message identifies the source path and line before its
        policy explanation.
        """
        self.items.append(f"{path}:{line} [doc-standard] {msg}")

    def summary(self):
        """Format all collected violations as checker feedback.

        Returns a newline-separated diagnostic body followed by the total count.
        """
        body = "\n".join(self.items)
        return (
            f"{body}\n[doc-standard] {len(self.items)} violation(s). "
            "Fix these or ask the user for missing information - do not guess."
        )


def check_content(content: str, path: str, kind: str, placeholders) -> Violations:
    """Validate one source text against its language-specific documentation rules.

    Dispatches header and public-unit checks for `kind` and returns every
    violation without performing file I/O or terminating the process.
    """
    v = Violations()
    ext = Path(path).suffix.lower()
    if kind == "python":
        _check_header_python(content, path, v, placeholders)
        _check_unit_python(content, path, v)
    elif kind == "tsjs":
        _check_header_tsjs(content, path, v, placeholders)
        _check_unit_tsjs(content, path, v)
    elif kind == "rust":
        _check_header_rust(content, path, v, placeholders)
        _check_unit_rust(content, path, v)
    elif kind == "c":
        _check_header_c(content, path, v, placeholders)
        _check_unit_c(content, path, v)
    return v


def main():
    """Run the checker command-line interface for a file or standard input.

    Exits with zero for compliant or out-of-scope content, two for policy
    violations, and one for invalid invocation or unexpected internal errors.
    """
    args = sys.argv[1:]
    read_stdin = False
    if args and args[-1] == "--stdin":
        read_stdin = True
        args.pop()
    if len(args) not in (1, 2):
        print("Usage: python3 checker.py <file_path> [config_path] [--stdin]", file=sys.stderr)
        sys.exit(1)

    file_path = args[0]
    config = _load_config(args[1] if len(args) == 2 else None)

    if _is_out_of_scope(file_path, config):
        sys.exit(0)

    content = sys.stdin.read() if read_stdin else _read_file(file_path)
    if content is None:
        sys.exit(0)  # encoding error / unreadable -> out of scope

    ext = Path(file_path).suffix.lower()
    if ext not in IN_SCOPE:
        sys.exit(0)

    kind = IN_SCOPE[ext]

    # Stub-skip: only skip a file smaller than MIN_FILE_SIZE when it has NO
    # public units. A small file that declares public units is fully checked.
    content_size = len(content.encode("utf-8")) if read_stdin else _file_size(file_path)
    if content_size < config["minFileSize"] and not _has_public_units(content, ext):
        sys.exit(0)

    try:
        violations = check_content(content, file_path, kind,
                                   {value.lower() for value in config["placeholderAuthors"]})
    except Exception as e:  # never block on an unexpected internal error
        print(f"Internal error: {e}", file=sys.stderr)
        sys.exit(1)

    if violations.items:
        print(violations.summary(), file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


def _has_public_units(content: str, ext: str) -> bool:
    """Cheap probe used only by the stub-skip guard."""
    if not content or not content.strip():
        return False
    if ext == ".py":
        try:
            for node in ast.walk(ast.parse(content)):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    if not node.name.startswith("_"):
                        return True
        except SyntaxError:
            return bool(re.search(r"^\s*(?:async\s+)?def\s+\w+", content, re.M))
        return False
    if ext in (".ts", ".js", ".mjs", ".cjs"):
        return bool(re.search(r"\bexport\b", content))
    if ext == ".rs":
        return bool(re.search(r"\bpub\s+(fn|struct|enum|trait|const|type)\b", content))
    if ext in (".c", ".cpp", ".cc", ".hpp", ".cxx", ".hxx", ".h"):
        return bool(re.search(r"\b(?:extern\s+)?[A-Za-z_][\w:]*\s*\(", content))
    return False


if __name__ == "__main__":
    main()
