import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface ExecResult {
  stdout: string
  stderr: string
}

interface ExecOptions {
  cwd?: string
  env?: Record<string, string | undefined>
}

export async function exec(cmd: string, args: string[], opts?: ExecOptions): Promise<ExecResult> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    cwd: opts?.cwd,
    env: { ...process.env, ...opts?.env },
  })
  return { stdout: stdout.toString(), stderr: stderr.toString() }
}

export function execStream(cmd: string, args: string[], opts?: ExecOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: { ...process.env, ...opts?.env },
      stdio: 'inherit',
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

/**
 * Spawn a process and capture its stdout (while inheriting stderr).
 * Used to capture structured output from child processes.
 */
export function execCapture(cmd: string, args: string[], opts?: ExecOptions): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: { ...process.env, ...opts?.env },
      stdio: ['inherit', 'pipe', 'inherit'],
    })
    let stdout = ''
    child.stdout!.on('data', (data) => { stdout += data.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout })
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd])
    return true
  } catch {
    return false
  }
}
