/**
 * Minimal, dependency-free YAML handling for the cordis patch layer
 * (`~/.dsh/cordis.patch.yml`). It understands only the shape that patch file
 * uses: a top-level list of operations, each of which may carry an `insert`
 * list of plugin rows, each row an optional `id`/`name`/`config` map (with a
 * nested `config` map). It preserves all surrounding text (comments, blank
 * lines, other operations) and only (re)serializes the insert rows.
 */

/**
 * Split a patch document into the text before the first `- insert:` operation
 * and the insert operation itself (its `- insert:` line plus the indented rows).
 * @param {string} text - the full patch file contents.
 * @returns {{ header: string, insertOp: string | null }}
 */
export function splitPatch(text) {
  const lines = text.split('\n')
  let insertStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '- insert:') {
      insertStart = i
      break
    }
  }
  if (insertStart === -1) {
    return { header: text, insertOp: null }
  }
  // Collect the insert operation: the "- insert:" line plus all following lines
  // that are indented (members of the insert list).
  const opLines = [lines[insertStart]]
  for (let i = insertStart + 1; i < lines.length; i++) {
    if (/^\s+/.test(lines[i])) {
      opLines.push(lines[i])
    } else if (opLines.length > 1 && lines[i].trim() === '') {
      // keep a single trailing blank line that sits between rows
      opLines.push(lines[i])
    } else {
      break
    }
  }
  const header = text.slice(0, lines.slice(0, insertStart).join('\n').length)
  return { header, insertOp: opLines.join('\n') }
}

/**
 * Parse the rows of an insert operation into plain objects. Row-level keys sit
 * at one indentation depth; a `config:` map's keys sit deeper and are nested.
 * @param {string} insertOp - the `- insert:` line plus its indented rows.
 * @returns {object[]}
 */
export function parseRows(insertOp) {
  const lines = (insertOp ?? '').split('\n')
  const rows = []
  let current = null
  let configDepth = null

  const parseKV = (text, depth) => {
    const colon = text.indexOf(':')
    if (colon === -1) return
    const key = text.slice(0, colon).trim()
    let value = text.slice(colon + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key === 'config') {
      current.config = {}
      configDepth = depth + 2
    } else if (current.config !== undefined && configDepth !== null && depth >= configDepth) {
      current.config[key] = value
    } else {
      current[key] = value
    }
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '- insert:') continue
    const depth = raw.search(/\S/)
    if (trimmed.startsWith('- ')) {
      if (current) rows.push(current)
      current = {}
      configDepth = null
      parseKV(trimmed.slice(2), depth)
      continue
    }
    if (current === null) continue
    parseKV(trimmed, depth)
  }
  if (current) rows.push(current)
  return rows
}

/**
 * Serialize rows back into an insert operation block.
 * @param {object[]} rows - parsed rows.
 * @returns {string}
 */
export function formatRows(rows) {
  const out = ['- insert:']
  for (const row of rows) {
    if (row.id !== undefined) out.push(`    - id: ${row.id}`)
    if (row.name !== undefined) out.push(`      name: ${row.name}`)
    if (row.config && typeof row.config === 'object') {
      out.push('      config:')
      for (const [k, v] of Object.entries(row.config)) {
        out.push(`        ${k}: ${v}`)
      }
    }
  }
  return out.join('\n')
}
