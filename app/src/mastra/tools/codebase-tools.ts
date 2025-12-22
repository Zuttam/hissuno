/**
 * Codebase Tools for Mastra Agents
 *
 * These tools allow agents to explore and analyze codebases stored in Supabase Storage.
 * The codebase files are stored in the 'codebases' bucket with path format:
 * {userId}/{projectId}/{timestamp}/{relativePath}
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const CODEBASE_BUCKET = 'codebases'

// Common text file extensions for code analysis
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.yaml',
  '.yml',
  '.toml',
  '.env',
  '.env.example',
  '.gitignore',
  '.prettierrc',
  '.eslintrc',
  '.css',
  '.scss',
  '.html',
  '.xml',
  '.svg',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.sql',
  '.graphql',
  '.prisma',
])

/**
 * List files in a codebase stored in Supabase Storage
 */
export const listCodebaseFilesTool = createTool({
  id: 'list-codebase-files',
  description: `List files and directories in a codebase. Use this to explore the project structure.
You can optionally provide a prefix to list files in a specific subdirectory.
Returns file paths, sizes, and whether each item is a file or directory.`,
  inputSchema: z.object({
    storagePath: z.string().describe('The base storage path of the codebase (e.g., userId/projectId/timestamp)'),
    prefix: z
      .string()
      .optional()
      .describe('Optional subdirectory prefix to list (e.g., "src" or "src/components")'),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to list files recursively in subdirectories'),
  }),
  outputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        name: z.string(),
        isDirectory: z.boolean(),
        size: z.number().optional(),
      })
    ),
    totalCount: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { storagePath, prefix = '', recursive = false } = context

    try {
      const supabase = createAdminClient()
      const fullPath = prefix ? `${storagePath}/${prefix}` : storagePath

      const files = await listFilesRecursively(supabase, fullPath, storagePath, recursive)

      return {
        files,
        totalCount: files.length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list files'
      return {
        files: [],
        totalCount: 0,
        error: message,
      }
    }
  },
})

/**
 * Read the content of a specific file from the codebase
 */
export const readCodebaseFileTool = createTool({
  id: 'read-codebase-file',
  description: `Read the content of a specific file from the codebase.
Use this after listing files to read important files like package.json, README.md, or source code files.
Returns the file content as text. Only works with text-based files.`,
  inputSchema: z.object({
    storagePath: z.string().describe('The base storage path of the codebase'),
    filePath: z.string().describe('The relative path to the file within the codebase (e.g., "package.json" or "src/index.ts")'),
  }),
  outputSchema: z.object({
    content: z.string(),
    path: z.string(),
    size: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { storagePath, filePath } = context

    try {
      const supabase = createAdminClient()
      const fullPath = `${storagePath}/${filePath}`

      const { data, error } = await supabase.storage.from(CODEBASE_BUCKET).download(fullPath)

      if (error) {
        return {
          content: '',
          path: filePath,
          size: 0,
          error: `Failed to download file: ${error.message}`,
        }
      }

      const text = await data.text()

      return {
        content: text,
        path: filePath,
        size: text.length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read file'
      return {
        content: '',
        path: filePath,
        size: 0,
        error: message,
      }
    }
  },
})

/**
 * Search for patterns within codebase files
 */
export const searchCodebaseFilesTool = createTool({
  id: 'search-codebase-files',
  description: `Search for a pattern or text within codebase files.
Use this to find specific code patterns, function definitions, imports, or any text.
Optionally filter by file extensions. Returns matching files with context snippets.`,
  inputSchema: z.object({
    storagePath: z.string().describe('The base storage path of the codebase'),
    pattern: z.string().describe('The search pattern or text to find (case-insensitive)'),
    fileExtensions: z
      .array(z.string())
      .optional()
      .describe('Optional list of file extensions to search (e.g., [".ts", ".tsx"])'),
    maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        file: z.string(),
        lineNumber: z.number(),
        line: z.string(),
        context: z.string(),
      })
    ),
    totalMatches: z.number(),
    filesSearched: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { storagePath, pattern, fileExtensions, maxResults = 20 } = context

    try {
      const supabase = createAdminClient()

      // List all files recursively
      const files = await listFilesRecursively(supabase, storagePath, storagePath, true)
      const textFiles = files.filter((f) => {
        if (f.isDirectory) return false
        const ext = getFileExtension(f.name)
        if (fileExtensions && fileExtensions.length > 0) {
          return fileExtensions.includes(ext)
        }
        return TEXT_EXTENSIONS.has(ext)
      })

      const matches: Array<{
        file: string
        lineNumber: number
        line: string
        context: string
      }> = []

      const searchRegex = new RegExp(escapeRegExp(pattern), 'gi')

      for (const file of textFiles) {
        if (matches.length >= maxResults) break

        try {
          const fullPath = `${storagePath}/${file.path}`
          const { data, error } = await supabase.storage.from(CODEBASE_BUCKET).download(fullPath)

          if (error || !data) continue

          const content = await data.text()
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= maxResults) break

            const line = lines[i]
            if (searchRegex.test(line)) {
              // Get context (2 lines before and after)
              const contextStart = Math.max(0, i - 2)
              const contextEnd = Math.min(lines.length - 1, i + 2)
              const contextLines = lines.slice(contextStart, contextEnd + 1)

              matches.push({
                file: file.path,
                lineNumber: i + 1,
                line: line.trim(),
                context: contextLines.join('\n'),
              })
            }

            // Reset regex lastIndex for global search
            searchRegex.lastIndex = 0
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        matches,
        totalMatches: matches.length,
        filesSearched: textFiles.length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search files'
      return {
        matches: [],
        totalMatches: 0,
        filesSearched: 0,
        error: message,
      }
    }
  },
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface FileInfo {
  path: string
  name: string
  isDirectory: boolean
  size?: number
}

async function listFilesRecursively(
  supabase: ReturnType<typeof createAdminClient>,
  currentPath: string,
  basePath: string,
  recursive: boolean
): Promise<FileInfo[]> {
  const results: FileInfo[] = []

  const { data: items, error } = await supabase.storage.from(CODEBASE_BUCKET).list(currentPath)

  if (error || !items) {
    return results
  }

  for (const item of items) {
    const itemPath = currentPath === basePath ? item.name : `${currentPath.replace(basePath + '/', '')}/${item.name}`

    // item.metadata exists for files, null for folders
    const isDirectory = !item.metadata

    results.push({
      path: itemPath,
      name: item.name,
      isDirectory,
      size: item.metadata?.size,
    })

    if (isDirectory && recursive) {
      const subPath = `${currentPath}/${item.name}`
      const subItems = await listFilesRecursively(supabase, subPath, basePath, true)
      results.push(...subItems)
    }
  }

  return results
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.slice(lastDot).toLowerCase()
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
