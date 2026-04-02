import fs from 'node:fs'
import path from 'node:path'
import { execStream } from '../../lib/exec.js'
import { log } from '../../lib/log.js'

export async function cloneRepo(): Promise<string> {
  const projectDir = path.resolve('hissuno')

  if (fs.existsSync(projectDir)) {
    throw new Error('Directory "hissuno" already exists')
  }

  log.info('Cloning Hissuno...')
  await execStream('git', [
    'clone',
    '--depth',
    '1',
    'https://github.com/zuttam/hissuno.git',
    projectDir,
  ])

  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true })
  log.success('Repository cloned')

  return projectDir
}
