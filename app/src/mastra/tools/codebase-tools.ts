/**
 * Codebase Tools for Mastra Agents
 *
 * These tools allow agents to explore and analyze codebases from local git clones.
 * The codebase files are stored in ephemeral directories under /tmp/hissuno/
 * Path format: /tmp/hissuno/{projectId}-{branch}/{relativePath}
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { readdir, readFile, stat } from 'fs/promises'
import { join, relative } from 'path'

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

// Directories to skip during exploration
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.nyc_output',
])

/**
 * List files in a local codebase directory
 */
export const listCodebaseFilesTool = createTool({
  id: 'list-codebase-files',
  description: `List files and directories in a codebase. Use this to explore the project structure.
You can optionally provide a prefix to list files in a specific subdirectory.
Returns file paths, sizes, and whether each item is a file or directory.`,
  inputSchema: z.object({
    localPath: z.string().describe('The local filesystem path to the cloned repository'),
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
  execute: async (context) => {
    const { localPath, prefix = '', recursive = false } = context

    try {
      const targetPath = prefix ? join(localPath, prefix) : localPath
      const files = await listFilesLocal(targetPath, localPath, recursive)

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
    localPath: z.string().describe('The local filesystem path to the cloned repository'),
    filePath: z.string().describe('The relative path to the file within the codebase (e.g., "package.json" or "src/index.ts")'),
  }),
  outputSchema: z.object({
    content: z.string(),
    path: z.string(),
    size: z.number(),
    error: z.string().optional(),
  }),
  execute: async (context) => {
    const { localPath, filePath } = context

    try {
      const fullPath = join(localPath, filePath)
      const content = await readFile(fullPath, 'utf-8')

      return {
        content,
        path: filePath,
        size: content.length,
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
    localPath: z.string().describe('The local filesystem path to the cloned repository'),
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
  execute: async (context) => {
    const { localPath, pattern, fileExtensions, maxResults = 20 } = context

    try {
      // List all files recursively
      const files = await listFilesLocal(localPath, localPath, true)
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
          const fullPath = join(localPath, file.path)
          const content = await readFile(fullPath, 'utf-8')
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

async function listFilesLocal(
  currentPath: string,
  basePath: string,
  recursive: boolean
): Promise<FileInfo[]> {
  const results: FileInfo[] = []

  try {
    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files except .gitignore, .env.example
      if (entry.name.startsWith('.') && entry.name !== '.gitignore' && entry.name !== '.env.example') {
        continue
      }

      // Skip common non-essential directories
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue
      }

      const fullPath = join(currentPath, entry.name)
      const relativePath = relative(basePath, fullPath)

      if (entry.isDirectory()) {
        results.push({
          path: relativePath,
          name: entry.name,
          isDirectory: true,
        })

        if (recursive) {
          const subItems = await listFilesLocal(fullPath, basePath, true)
          results.push(...subItems)
        }
      } else {
        try {
          const stats = await stat(fullPath)
          results.push({
            path: relativePath,
            name: entry.name,
            isDirectory: false,
            size: stats.size,
          })
        } catch {
          // If we can't stat, still include with no size
          results.push({
            path: relativePath,
            name: entry.name,
            isDirectory: false,
          })
        }
      }
    }
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty
    console.error('[codebase-tools] Failed to list directory:', currentPath, error)
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
