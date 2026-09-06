#!/usr/bin/env node
/**
 * @module install-repository-hooks
 * @author Perijn
 * Installs native Git hook wrappers in the current repository.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { installRepositoryHooks } from '../src/repository-hooks.mjs'

const packageRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')

let hookPath
try {
  hookPath = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
} catch {
  throw new Error('Run gitbutler-commit-standard-hooks from a Git repository after but setup.')
}

const hooksDirectory = resolve(process.cwd(), hookPath)
await installRepositoryHooks({ hooksDirectory, packageRoot })
console.log(`Installed GitButler-compatible hooks in ${hooksDirectory}.`)
console.log('Run this after but setup; it is safe to rerun after GitButler repairs its hooks.')
