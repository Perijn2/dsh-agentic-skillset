/**
 * @module uninstall
 * @author Perijn
 * Removes legacy installer state without changing repository-local hooks.
 *
 * @remarks
 * Includes:
 *   - uninstall entrypoint: restores only installer-managed Git configuration.
 *
 * Usage:
 *   node scripts/uninstall.mjs
 */

import { existsSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const statePath = join(homedir(), '.dsh', 'gitbutler-commit-standard', 'install-state.json')
if (existsSync(statePath)) unlinkSync(statePath)
console.log('Removed legacy package state. Repository-local hooks are left intact.')
