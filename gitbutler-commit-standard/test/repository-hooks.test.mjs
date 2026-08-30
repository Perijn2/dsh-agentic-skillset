/**
 * @module repository-hooks.test
 * @author Perijn
 * Tests installation of GitButler-native repository hook wrappers.
 *
 * Usage:
 *   node --test test/repository-hooks.test.mjs
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { installRepositoryHooks } from '../src/repository-hooks.mjs'

/** Verify user hooks are preserved and wrapper installation is idempotent. */
test('installs GitButler-compatible pre-commit-user and commit-msg wrappers', async () => {
  const hooksDirectory = await mkdtemp(join(tmpdir(), 'gitbutler-hooks-'))
  const packageRoot = new URL('..', import.meta.url).pathname
  await writeFile(join(hooksDirectory, 'pre-commit-user'), '#!/usr/bin/env bash\necho prior-pre-commit\n', { mode: 0o755 })
  await writeFile(join(hooksDirectory, 'commit-msg'), '#!/usr/bin/env bash\necho prior-commit-msg\n', { mode: 0o755 })

  await installRepositoryHooks({ hooksDirectory, packageRoot })
  await installRepositoryHooks({ hooksDirectory, packageRoot })

  assert.match(await readFile(join(hooksDirectory, 'pre-commit-user'), 'utf8'), /GITBUTLER_COMMIT_STANDARD_PRE_COMMIT_USER/)
  assert.match(await readFile(join(hooksDirectory, 'commit-msg'), 'utf8'), /GITBUTLER_COMMIT_STANDARD_COMMIT_MSG/)
  assert.equal(await readFile(join(hooksDirectory, 'pre-commit-user.original'), 'utf8'), '#!/usr/bin/env bash\necho prior-pre-commit\n')
  assert.equal(await readFile(join(hooksDirectory, 'commit-msg-user'), 'utf8'), '#!/usr/bin/env bash\necho prior-commit-msg\n')
  assert.equal((await readdir(hooksDirectory)).filter((name) => name.includes('.original')).length, 1)
  assert.ok((await stat(join(hooksDirectory, 'pre-commit-user'))).mode & 0o111)
  assert.ok((await stat(join(hooksDirectory, 'commit-msg'))).mode & 0o111)
})

/** Verify the native commit-msg wrapper rejects invalid and accepts conventional messages. */
test('commit-msg wrapper runs commitlint against the supplied message file', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'gitbutler-commit-msg-'))
  execFileSync('git', ['init', '--quiet', repository])
  const hooksDirectory = join(repository, '.git', 'hooks')
  const packageRoot = fileURLToPath(new URL('..', import.meta.url))
  const invalidMessage = join(hooksDirectory, 'invalid-message')
  const validMessage = join(hooksDirectory, 'valid-message')
  await writeFile(invalidMessage, 'this is not a conventional commit\n')
  await writeFile(validMessage, 'feat: validate the native commit hook\n')

  try {
    await installRepositoryHooks({ hooksDirectory, packageRoot })
    assert.throws(
      () => execFileSync('bash', [join(hooksDirectory, 'commit-msg'), invalidMessage], { cwd: repository, stdio: 'pipe' }),
      /Command failed/,
    )
    assert.doesNotThrow(() => execFileSync('bash', [join(hooksDirectory, 'commit-msg'), validMessage], { cwd: repository, stdio: 'pipe' }))
  } finally {
    await rm(repository, { recursive: true, force: true })
  }
})
