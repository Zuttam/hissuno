import { commandExists } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export async function checkNode(): Promise<void> {
  const major = parseInt(process.versions.node.split('.')[0], 10)
  if (major < 20) {
    throw new Error(`Node.js 20+ required. You have v${process.versions.node}`)
  }
  log.success(`Node.js v${process.versions.node}`)

  const hasGit = await commandExists('git')
  if (!hasGit) {
    throw new Error('git is required but not found on PATH')
  }
  log.success('git found')
}
