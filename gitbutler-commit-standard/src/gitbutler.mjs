/**
 * @module gitbutler
 * @author Perijn
 * Detects and installs the GitButler CLI with explicit confirmation.
 *
 * @remarks
 * Includes:
 *   - detectBut: verify the installed but executable.
 *   - installBut: invoke the official installer after confirmation.
 *
 * Usage:
 *   const status = await detectBut({ run });
 */

import { spawn } from 'node:child_process'

/** Run a command and collect its textual result. */
export function runProcess(argv) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => { stdout += data })
    child.stderr.on('data', (data) => { stderr += data })
    child.on('error', () => resolve({ code: 1, stdout, stderr }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

/** Verify that but is available on PATH and report its version. */
export async function detectBut({ run = runProcess } = {}) {
  const result = await run(['but', '--version'])
  const match = result.code === 0 && /(?:but\s+)?v?(\d+(?:\.\d+)+)/i.exec(result.stdout)
  return match ? { available: true, version: match[1] } : { available: false, version: null }
}

/** Return verified GitButler metadata or fail with a clear prerequisite error. */
export async function requireBut(options = {}) {
  const status = await detectBut(options)
  if (!status.available) throw new Error('GitButler CLI (but) is not available on PATH.')
  return status
}

/** Install GitButler using its official Unix installer after confirmation. */
export async function installBut({ confirm, platform = process.platform, run = runProcess } = {}) {
  if (!confirm) throw new Error('GitButler installation requires confirmation.')
  if (!['darwin', 'linux'].includes(platform)) throw new Error('Install GitButler manually on this platform.')
  const result = await run(['sh', '-c', 'curl -fsSL https://gitbutler.com/install.sh | sh'])
  if (result.code !== 0) throw new Error(result.stderr || 'GitButler installation failed.')
  return requireBut({ run })
}
