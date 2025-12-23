/**
 * Knowledge Tools for Support Agent
 *
 * These tools allow the support agent to dynamically access project knowledge packages
 * based on the type of question being asked. Knowledge is organized into three categories:
 * - business: Company info, mission, values, policies, pricing
 * - product: Features, capabilities, user guides, FAQs
 * - technical: Architecture, APIs, integrations, technical specs
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { downloadKnowledgePackage } from '@/lib/knowledge/storage'
import type { KnowledgeCategory, KnowledgePackageRecord } from '@/lib/knowledge/types'

const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = ['business', 'product', 'technical']

/**
 * List available knowledge packages for a project
 */
export const listProjectKnowledgeTool = createTool({
  id: 'list-project-knowledge',
  description: `List all available knowledge packages for a project.
Use this tool first to understand what knowledge is available before retrieving specific packages.
Returns the categories (business, product, technical) that have been compiled, along with version info.`,
  inputSchema: z.object({
    projectId: z.string().uuid().describe('The project ID to list knowledge for'),
  }),
  outputSchema: z.object({
    packages: z.array(
      z.object({
        category: z.enum(['business', 'product', 'technical']),
        version: z.number(),
        generatedAt: z.string(),
        storagePath: z.string(),
      })
    ),
    hasKnowledge: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { projectId } = context

    try {
      const supabase = createAdminClient()

      const { data: packages, error } = await supabase
        .from('knowledge_packages')
        .select('category, version, generated_at, storage_path')
        .eq('project_id', projectId)
        .order('category', { ascending: true })

      if (error) {
        return {
          packages: [],
          hasKnowledge: false,
          error: `Failed to list knowledge packages: ${error.message}`,
        }
      }

      if (!packages || packages.length === 0) {
        return {
          packages: [],
          hasKnowledge: false,
        }
      }

      return {
        packages: packages.map((pkg) => ({
          category: pkg.category as KnowledgeCategory,
          version: pkg.version,
          generatedAt: pkg.generated_at,
          storagePath: pkg.storage_path,
        })),
        hasKnowledge: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        packages: [],
        hasKnowledge: false,
        error: message,
      }
    }
  },
})

/**
 * Get the content of a specific knowledge package
 */
export const getKnowledgePackageTool = createTool({
  id: 'get-knowledge-package',
  description: `Retrieve the full content of a specific knowledge package by category.
Use this when you know which category of knowledge is most relevant to the user's question:
- business: Company info, mission, values, policies, pricing, business model
- product: Features, capabilities, how-to guides, FAQs, user documentation
- technical: Architecture, APIs, integrations, technical specifications, developer docs`,
  inputSchema: z.object({
    projectId: z.string().uuid().describe('The project ID'),
    category: z
      .enum(['business', 'product', 'technical'])
      .describe('The knowledge category to retrieve'),
  }),
  outputSchema: z.object({
    category: z.enum(['business', 'product', 'technical']),
    content: z.string(),
    version: z.number(),
    generatedAt: z.string(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { projectId, category } = context

    try {
      const supabase = createAdminClient()

      // Get package metadata from database
      const { data: pkg, error: dbError } = await supabase
        .from('knowledge_packages')
        .select('*')
        .eq('project_id', projectId)
        .eq('category', category)
        .single()

      if (dbError || !pkg) {
        return {
          category,
          content: '',
          version: 0,
          generatedAt: '',
          found: false,
          error: dbError ? `Package not found: ${dbError.message}` : 'Package not found',
        }
      }

      // Download content from storage
      const { content, error: downloadError } = await downloadKnowledgePackage(
        pkg.storage_path,
        supabase
      )

      if (downloadError || !content) {
        return {
          category,
          content: '',
          version: pkg.version,
          generatedAt: pkg.generated_at,
          found: false,
          error: downloadError?.message ?? 'Failed to download content',
        }
      }

      return {
        category,
        content,
        version: pkg.version,
        generatedAt: pkg.generated_at,
        found: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        category,
        content: '',
        version: 0,
        generatedAt: '',
        found: false,
        error: message,
      }
    }
  },
})

/**
 * Search across knowledge packages for relevant content
 */
export const searchKnowledgeTool = createTool({
  id: 'search-knowledge',
  description: `Search across all knowledge packages for content matching a query.
Use this when you're not sure which category contains the relevant information,
or when the question might span multiple categories.
Returns matching snippets with their source category for context.`,
  inputSchema: z.object({
    projectId: z.string().uuid().describe('The project ID to search within'),
    query: z.string().describe('The search query or keywords to find'),
    categories: z
      .array(z.enum(['business', 'product', 'technical']))
      .optional()
      .describe('Optional: limit search to specific categories'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        category: z.enum(['business', 'product', 'technical']),
        snippet: z.string(),
        relevanceContext: z.string(),
      })
    ),
    searchedCategories: z.array(z.string()),
    totalMatches: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { projectId, query, categories } = context
    const categoriesToSearch = categories ?? KNOWLEDGE_CATEGORIES

    try {
      const supabase = createAdminClient()

      // Get all relevant packages
      const { data: packages, error: dbError } = await supabase
        .from('knowledge_packages')
        .select('*')
        .eq('project_id', projectId)
        .in('category', categoriesToSearch)

      if (dbError) {
        return {
          results: [],
          searchedCategories: [],
          totalMatches: 0,
          error: `Failed to fetch packages: ${dbError.message}`,
        }
      }

      if (!packages || packages.length === 0) {
        return {
          results: [],
          searchedCategories: categoriesToSearch,
          totalMatches: 0,
        }
      }

      const results: Array<{
        category: KnowledgeCategory
        snippet: string
        relevanceContext: string
      }> = []

      // Search through each package
      for (const pkg of packages) {
        const { content, error: downloadError } = await downloadKnowledgePackage(
          pkg.storage_path,
          supabase
        )

        if (downloadError || !content) continue

        // Search for query terms (case-insensitive)
        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean)
        const lines = content.split('\n')
        const matchingSnippets: string[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase()
          const hasMatch = searchTerms.some((term) => line.includes(term))

          if (hasMatch) {
            // Get context: 2 lines before and after
            const contextStart = Math.max(0, i - 2)
            const contextEnd = Math.min(lines.length - 1, i + 2)
            const snippet = lines.slice(contextStart, contextEnd + 1).join('\n')

            // Avoid duplicate snippets
            if (!matchingSnippets.some((s) => s.includes(lines[i]))) {
              matchingSnippets.push(snippet)
            }

            // Limit snippets per category
            if (matchingSnippets.length >= 3) break
          }
        }

        // Add results for this category
        for (const snippet of matchingSnippets) {
          results.push({
            category: pkg.category as KnowledgeCategory,
            snippet: snippet.trim(),
            relevanceContext: `Found in ${pkg.category} knowledge (v${pkg.version})`,
          })
        }
      }

      return {
        results,
        searchedCategories: packages.map((p) => p.category),
        totalMatches: results.length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        results: [],
        searchedCategories: [],
        totalMatches: 0,
        error: message,
      }
    }
  },
})

// Export all tools as an array for easy registration
export const knowledgeTools = [
  listProjectKnowledgeTool,
  getKnowledgePackageTool,
  searchKnowledgeTool,
]
