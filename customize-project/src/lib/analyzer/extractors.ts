import type {
  AnalyzerWarning,
  ApiEndpointSummary,
  ComponentUsage,
  DesignSystemSummary,
} from '@/types/analyzer'
import type { AnalyzerFileEntry } from './collectors'

const TOKEN_REGEX = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g
const COMPONENT_REGEX =
  /export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)|export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\(/g
const HOOK_COMPONENT_REGEX =
  /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

export function extractDesignSystem(
  entries: AnalyzerFileEntry[],
  warnings: AnalyzerWarning[]
): DesignSystemSummary {
  const tokens: DesignSystemSummary['tokens'] = []
  const components: ComponentUsage[] = []

  for (const entry of entries) {
    if (entry.filePath.endsWith('.css')) {
      let match: RegExpExecArray | null
      while ((match = TOKEN_REGEX.exec(entry.content)) !== null) {
        const [, name, value] = match
        tokens.push({
          name,
          value: value.trim(),
          description: `CSS variable extracted from ${entry.filePath}`,
        })
      }
    }

    if (/(\.tsx|\.jsx|\.ts)/.test(entry.filePath)) {
      let match: RegExpExecArray | null
      COMPONENT_REGEX.lastIndex = 0
      while ((match = COMPONENT_REGEX.exec(entry.content)) !== null) {
        const name = match[1] || match[2]
        if (!name) continue
        components.push({
          name,
          filePath: entry.filePath,
          description: `Exported React component in ${entry.filePath}`,
        })
      }

      const defaultMatch = HOOK_COMPONENT_REGEX.exec(entry.content)
      if (defaultMatch) {
        const name = defaultMatch[1]
        components.push({
          name,
          filePath: entry.filePath,
          description: `Default exported React component in ${entry.filePath}`,
        })
      }
    }
  }

  if (!tokens.length) {
    warnings.push({
      code: 'no_tokens_found',
      message: 'No CSS design tokens were detected.',
      suggestion:
        'Ensure your design tokens are defined as CSS variables or upload the relevant stylesheets.',
    })
  }

  if (!components.length) {
    warnings.push({
      code: 'no_components_found',
      message: 'No exported React components were detected.',
      suggestion:
        'Make sure to include .tsx or .jsx files that export components.',
    })
  }

  return { tokens, components }
}

export function extractApiSurface(
  entries: AnalyzerFileEntry[],
  warnings: AnalyzerWarning[]
): ApiEndpointSummary[] {
  const apiEndpoints: ApiEndpointSummary[] = []

  for (const entry of entries) {
    const normalizedPath = entry.filePath.toLowerCase()
    const likelyApiFile = /\/api\//.test(normalizedPath) || normalizedPath.endsWith('.route.ts')

    if (!likelyApiFile) continue

    const matches: ApiEndpointSummary[] = []

    for (const method of HTTP_METHODS) {
      const methodPattern = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`,
        'g'
      )
      if (methodPattern.test(entry.content)) {
        matches.push({
          method,
          path: deriveRouteFromFile(entry.filePath),
          filePath: entry.filePath,
        })
      }
    }

    const routerPattern = /(router|app)\.(get|post|put|patch|delete|options)\(/gi
    let routerMatch: RegExpExecArray | null
    while ((routerMatch = routerPattern.exec(entry.content)) !== null) {
      const [, , verb] = routerMatch
      matches.push({
        method: verb.toUpperCase(),
        path: deriveRouteFromFile(entry.filePath),
        filePath: entry.filePath,
      })
    }

    apiEndpoints.push(...matches)
  }

  if (!apiEndpoints.length) {
    warnings.push({
      code: 'no_api_found',
      message: 'No API routes were detected.',
      suggestion:
        'Include Next.js API route files (e.g., app/api/*/route.ts) or server handlers.',
    })
  }

  return apiEndpoints
}

function deriveRouteFromFile(filePath: string) {
  const parts = filePath
    .replace(/\\/g, '/')
    .split('/app/')
    .pop()
    ?.replace(/route\.(ts|js|tsx|jsx)$/, '')

  if (!parts) return `/${filePath}`

  const normalized = parts
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/index$/i, ''))
    .join('/')

  return `/${normalized}`.replace(/\/+$/, '') || '/'
}

