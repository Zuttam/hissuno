import { confirm } from '@inquirer/prompts'
import { execStream } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export async function startServer(appDir: string, seeded: boolean, apiKey?: string, start?: boolean): Promise<void> {
  let shouldStart: boolean
  if (start !== undefined) {
    shouldStart = start
  } else {
    shouldStart = await confirm({
      message: 'Start Hissuno now?',
      default: true,
    })
  }

  if (!shouldStart) {
    log.nextSteps(seeded, apiKey)
    return
  }

  log.ready(seeded, apiKey)

  // This blocks until the user kills the process
  await execStream('npm', ['run', 'dev'], { cwd: appDir })
}
