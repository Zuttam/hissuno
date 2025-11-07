import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

export interface StagedUpload {
  filename: string
  path: string
  size: number
  buffer: Buffer
  cleanup: () => Promise<void>
}

const TMP_PREFIX = 'customize-analyzer'
const PROJECT_TMP_PREFIX = 'customize-project'

async function ensureDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true })
}

function sanitizeFilename(filename: string, fallback: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_').trim()
  return sanitized.length > 0 ? sanitized : fallback
}

export function getProjectTempRoot() {
  return path.join(tmpdir(), PROJECT_TMP_PREFIX)
}

export function getProjectTempDir(projectId: string) {
  return path.join(getProjectTempRoot(), projectId)
}

export async function persistProjectArchive(projectId: string, file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const projectDir = getProjectTempDir(projectId)
  await ensureDirectory(projectDir)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = sanitizeFilename(file.name, 'archive.zip')
  const destination = path.join(projectDir, `${timestamp}-${safeName}`)

  await fs.writeFile(destination, buffer)

  return {
    filename: file.name,
    path: destination,
    size: buffer.byteLength,
  }
}

export async function removeProjectTempDir(projectId: string) {
  const directory = getProjectTempDir(projectId)
  try {
    await fs.rm(directory, { recursive: true, force: true })
  } catch {
    // Swallow cleanup errors; temp storage best-effort only
  }
}

export async function stageUploadFile(file: File): Promise<StagedUpload> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
  const filename = `${TMP_PREFIX}-${randomUUID()}-${safeName}`
  const destination = path.join(tmpdir(), filename)

  await fs.writeFile(destination, buffer)

  const cleanup = async () => {
    try {
      await fs.unlink(destination)
    } catch {
      // ignore cleanup failures
    }
  }

  return {
    filename: file.name,
    path: destination,
    size: buffer.byteLength,
    buffer,
    cleanup,
  }
}

