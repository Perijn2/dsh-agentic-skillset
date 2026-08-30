/**
 * @module repository-hooks
 * @author Perijn
 * Installs repository-local hooks that cooperate with GitButler v0.21.
 */

import { chmod, rename, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PRE_COMMIT_MARKER = 'GITBUTLER_COMMIT_STANDARD_PRE_COMMIT_USER'
const COMMIT_MSG_MARKER = 'GITBUTLER_COMMIT_STANDARD_COMMIT_MSG'

function isManagedHook(path, marker) {
  return existsSync(path) && readFileSync(path, 'utf8').includes(marker)
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

async function preserveHook({ source, destination, marker }) {
  if (!existsSync(source) || isManagedHook(source, marker)) return
  if (existsSync(destination)) {
    throw new Error(`Refusing to overwrite preserved hook ${destination}. Move it aside and rerun the installer.`)
  }
  await rename(source, destination)
}

function preCommitUserContents() {
  return `#!/usr/bin/env bash
# ${PRE_COMMIT_MARKER}
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ORIGINAL="\${HOOKS_DIR}/pre-commit-user.original"

if [ -x "\${ORIGINAL}" ]; then
  "\${ORIGINAL}" "$@"
fi
`
}

function commitMsgContents(packageRoot) {
  return `#!/usr/bin/env bash
# ${COMMIT_MSG_MARKER}
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ORIGINAL="\${HOOKS_DIR}/commit-msg-user"

if [ -x "\${ORIGINAL}" ]; then
  "\${ORIGINAL}" "$@"
fi

exec node ${shellQuote(join(packageRoot, 'scripts', 'commit-msg.mjs'))} "$1"
`
}

async function writeExecutable(path, contents) {
  await writeFile(path, contents, { mode: 0o755 })
  await chmod(path, 0o755)
}

/** Install wrappers after `but setup` has created the GitButler managed hook. */
export async function installRepositoryHooks({ hooksDirectory, packageRoot }) {
  const preCommitUser = join(hooksDirectory, 'pre-commit-user')
  const commitMsg = join(hooksDirectory, 'commit-msg')
  await preserveHook({
    source: preCommitUser,
    destination: join(hooksDirectory, 'pre-commit-user.original'),
    marker: PRE_COMMIT_MARKER,
  })
  await preserveHook({
    source: commitMsg,
    destination: join(hooksDirectory, 'commit-msg-user'),
    marker: COMMIT_MSG_MARKER,
  })
  await writeExecutable(preCommitUser, preCommitUserContents())
  await writeExecutable(commitMsg, commitMsgContents(packageRoot))
}
