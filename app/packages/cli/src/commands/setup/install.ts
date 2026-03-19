import { execStream } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export async function installDeps(appDir: string): Promise<void> {
  log.info('Installing dependencies...')
  await execStream('npm', ['install'], { cwd: appDir })
  log.success('Dependencies installed')
}

export async function buildWidget(appDir: string): Promise<void> {
  log.info('Building feedback widget...')
  await execStream('npm', ['run', 'build:widget'], { cwd: appDir })
  log.success('Widget built')
}
