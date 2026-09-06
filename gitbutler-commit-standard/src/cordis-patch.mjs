/**
 * @module cordis-patch
 * @author Perijn
 * Inserts the GitButler standard into a Cordis patch-layer insert operation.
 *
 * @remarks
 * Includes:
 *   - upsertPluginPatch: add or replace the machine-wide plugin row.
 *
 * Usage:
 *   const next = upsertPluginPatch(existingPatchText);
 */

/** Insert one canonical GitButler plugin row into the Cordis insert list. */
export function upsertPluginPatch(text, pluginRoot = '.') {
  const row = [
    '    - id: gitbutler-commit-standard',
    '      name: gitbutler-commit-standard',
    '      config:',
    `        pluginRoot: ${pluginRoot}`,
  ].join('\n')
  let next = text.replace(/\n?- id: gitbutler-commit-standard\n(?:  .*\n?)*/g, '\n')
  next = next.replace(/\n?    - id: gitbutler-commit-standard\n(?:      .*\n?|        .*\n?)*/g, '\n')
  const insert = next.indexOf('- insert:')
  if (insert === -1) return `${next.replace(/\s*$/, '')}\n- insert:\n${row}\n`
  const after = insert + '- insert:'.length
  const boundary = next.indexOf('\n- ', after)
  const position = boundary === -1 ? next.length : boundary
  return `${next.slice(0, position).replace(/\s*$/, '')}\n${row}\n${next.slice(position)}`
}
