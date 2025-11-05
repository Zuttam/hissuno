import { promises as fs } from 'fs'
import path from 'path'
import type { AnalyzerWarning } from '@/types/analyzer'
import JSZip from 'jszip'

export interface AnalyzerFileEntry {
  filePath: string
  content: string
}

const MAX_FILES = 300

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.cache',
])

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.md',
  '.mdx',
  '.graphql',
  '.gql',
  '.yaml',
  '.yml',
])

function shouldInspect(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

async function walkDirectory(
  basePath: string,
  warnings: AnalyzerWarning[],
  entries: AnalyzerFileEntry[]
) {
  const stack: string[] = [basePath]

  while (stack.length && entries.length < MAX_FILES) {
    const currentPath = stack.pop()!

    const dirEntries = await fs
      .readdir(currentPath, { withFileTypes: true })
      .catch(() => undefined)

    if (!dirEntries) {
      warnings.push({
        code: 'read_error',
        message: `Unable to read directory: ${currentPath}`,
        suggestion: 'Check path permissions or ensure the directory exists.',
      })
      continue
    }

    for (const entry of dirEntries) {
      if (entries.length >= MAX_FILES) break

      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(entryPath)
        }
        continue
      }

      if (!shouldInspect(entryPath)) continue

      try {
        const content = await fs.readFile(entryPath, 'utf8')
        const relativePath = path.relative(basePath, entryPath) || entry.name
        entries.push({
          filePath: relativePath.replace(/\\/g, '/'),
          content,
        })
      } catch {
        warnings.push({
          code: 'file_read_error',
          message: `Unable to read file: ${entryPath}`,
          suggestion: 'Verify the file encoding is UTF-8 or try again.',
        })
      }
    }
  }

  if (entries.length >= MAX_FILES) {
    warnings.push({
      code: 'file_limit_reached',
      message: `Analysis limited to the first ${MAX_FILES} files.`,
      suggestion: 'Narrow the path or upload a smaller subset of files.',
    })
  }
}

export async function collectEntriesFromPath(
  targetPath: string
): Promise<{ entries: AnalyzerFileEntry[]; warnings: AnalyzerWarning[] }> {
  const absolutePath = path.resolve(targetPath)
  const warnings: AnalyzerWarning[] = []
  const stats = await fs.stat(absolutePath).catch(() => undefined)

  if (!stats) {
    return {
      entries: [],
      warnings: [
        {
          code: 'path_not_found',
          message: `Path not found: ${targetPath}`,
          suggestion: 'Verify the path exists and is accessible to the server.',
        },
      ],
    }
  }

  if (!stats.isDirectory()) {
    return {
      entries: [],
      warnings: [
        {
          code: 'path_not_directory',
          message: `Expected a directory but received a file: ${targetPath}`,
          suggestion: 'Provide a directory path or upload an archive instead.',
        },
      ],
    }
  }

  const entries: AnalyzerFileEntry[] = []
  await walkDirectory(absolutePath, warnings, entries)

  return { entries, warnings }
}

export async function collectEntriesFromZip(
  buffer: ArrayBuffer | Buffer,
  rootName = 'upload'
): Promise<{ entries: AnalyzerFileEntry[]; warnings: AnalyzerWarning[] }> {
  const warnings: AnalyzerWarning[] = []
  const entries: AnalyzerFileEntry[] = []

  const zip = await JSZip.loadAsync(buffer)

  const files = Object.values(zip.files)
  for (const file of files) {
    if (entries.length >= MAX_FILES) break
    if (file.dir) continue

    if (!shouldInspect(file.name)) continue

    try {
      const content = await file.async('string')
      const normalizedPath = path
        .join(rootName, file.name)
        .replace(/\\/g, '/')
      entries.push({ filePath: normalizedPath, content })
    } catch {
      warnings.push({
        code: 'zip_read_error',
        message: `Unable to read file from archive: ${file.name}`,
      })
    }
  }

  if (entries.length >= MAX_FILES) {
    warnings.push({
      code: 'file_limit_reached',
      message: `Analysis limited to the first ${MAX_FILES} files in the archive.`,
      suggestion: 'Upload a smaller archive or split the project into chunks.',
    })
  }

  if (!entries.length) {
    warnings.push({
      code: 'empty_archive',
      message: 'The uploaded archive did not contain any supported source files.',
      suggestion:
        'Include TypeScript, JavaScript, CSS, or configuration files in the archive.',
    })
  }

  return { entries, warnings }
}

