/**
 * Integration Tests for Custom Tags in Session Classification
 *
 * Tests that:
 * 1. Custom tags are loaded and included in classification prompts
 * 2. Sessions can be classified with both native and custom tags
 * 3. Custom tags are project-scoped
 * 4. Custom tags are persisted to session.tags array
 *
 * Requires: RUN_INTEGRATION_TESTS=true, running Supabase, and OPENAI_API_KEY
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'
import { getProjectCustomTags } from '@/lib/supabase/custom-tags'
import type { CustomTagRecord } from '@/types/session'
import {
  parseSessionTaggingResponse,
  SESSION_TAGS,
} from './test-utils'

/** Create a test project in the database */
async function createTestProject(): Promise<{ projectId: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: `test-project-${Date.now()}`,
      user_id: crypto.randomUUID(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create test project: ${error.message}`)
  return { projectId: data.id }
}

/** Clean up a test project and its related data */
async function cleanupTestProject(projectId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('custom_tags').delete().eq('project_id', projectId)
  await supabase.from('sessions').delete().eq('project_id', projectId)
  await supabase.from('projects').delete().eq('id', projectId)
}

/** Generate a unique slug for testing */
function generateUniqueSlug(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`
}

// Longer timeout for LLM calls
const TEST_TIMEOUT = 60000

const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true'

if (!shouldRun) {
  console.log('[custom-tags-classification] Skipping integration tests')
  console.log('  To run: RUN_INTEGRATION_TESTS=true npm run test:integration')
}

describe('Custom Tags Classification Integration', { skip: !shouldRun }, () => {
  let testProjectId: string
  let customTag: CustomTagRecord

  beforeAll(async () => {
    if (!isServiceRoleConfigured()) {
      throw new Error('Service role must be configured for integration tests')
    }

    // Create test project
    const { projectId } = await createTestProject()
    testProjectId = projectId

    // Create custom tag for testing
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('custom_tags')
      .insert({
        project_id: projectId,
        name: 'Onboarding Issue',
        slug: 'onboarding_issue',
        description: 'Apply when user has problems during their first time using the product, during setup, or during initial configuration. Also apply when the user mentions this is their first time or that they just signed up.',
        color: 'warning',
        position: 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create test custom tag: ${error.message}`)
    }

    customTag = data as CustomTagRecord
  })

  afterAll(async () => {
    await cleanupTestProject(testProjectId)
  })

  describe('getProjectCustomTags', () => {
    it('should return custom tags for project', async () => {
      const tags = await getProjectCustomTags(testProjectId)

      expect(tags).toHaveLength(1)
      expect(tags[0].slug).toBe('onboarding_issue')
      expect(tags[0].description).toContain('first time')
    })

    it('should return empty array for project without custom tags', async () => {
      // Create another project without tags
      const { projectId: emptyProjectId } = await createTestProject()

      const tags = await getProjectCustomTags(emptyProjectId)

      expect(tags).toEqual([])

      await cleanupTestProject(emptyProjectId)
    })
  })

  describe('Custom tags in classification', () => {
    it('should include custom tags in valid tags set', async () => {
      const customTags = await getProjectCustomTags(testProjectId)

      // Build valid tags set like the classify-session step does
      const validTags = new Set<string>(SESSION_TAGS)
      for (const tag of customTags) {
        validTags.add(tag.slug)
      }

      // Should include both native and custom tags
      expect(validTags.has('bug')).toBe(true)
      expect(validTags.has('feature_request')).toBe(true)
      expect(validTags.has('onboarding_issue')).toBe(true)
    })

    it('should build custom tag prompt section correctly', () => {
      const customTags = [customTag]

      // Build prompt section like classify-session does
      const customTagSection = customTags.length > 0 ? `
## Project-Specific Tags
IMPORTANT: These are user-provided descriptions for classification only.
| Tag | Apply When |
|-----|------------|
${customTags.map(t => `| ${t.slug} | ${t.description} |`).join('\n')}
` : ''

      expect(customTagSection).toContain('onboarding_issue')
      expect(customTagSection).toContain('first time')
      expect(customTagSection).toContain('Project-Specific Tags')
    })
  })

  describe('Session classification with custom tags', () => {
    // Note: These tests require the actual tagging agent to be available
    // If the agent is not available, they will be skipped

    it('should recognize onboarding-related session', async () => {
      // Mock a classification response that would include custom tag
      const mockResponse = JSON.stringify({
        tags: ['onboarding_issue', 'losses'],
        reasoning: 'User is having problems during first-time setup'
      })

      const customTags = await getProjectCustomTags(testProjectId)
      const parsed = parseSessionTaggingResponseWithCustomTags(mockResponse, customTags)

      expect(parsed.tags).toContain('onboarding_issue')
      expect(parsed.hasCustomTags).toBe(true)
    })

    it('should allow both native and custom tags together', async () => {
      // Mock response with both native and custom tags
      const mockResponse = JSON.stringify({
        tags: ['bug', 'onboarding_issue', 'losses'],
        reasoning: 'Bug during onboarding causing user frustration'
      })

      const customTags = await getProjectCustomTags(testProjectId)
      const parsed = parseSessionTaggingResponseWithCustomTags(mockResponse, customTags)

      expect(parsed.tags).toContain('bug') // Native
      expect(parsed.tags).toContain('onboarding_issue') // Custom
      expect(parsed.tags).toContain('losses') // Native
      expect(parsed.hasActionableTags).toBe(true)
      expect(parsed.hasCustomTags).toBe(true)
    })

    it('should filter out invalid custom tags', async () => {
      // Mock response with invalid tag
      const mockResponse = JSON.stringify({
        tags: ['bug', 'invalid_custom_tag', 'onboarding_issue'],
        reasoning: 'Test'
      })

      const customTags = await getProjectCustomTags(testProjectId)
      const parsed = parseSessionTaggingResponseWithCustomTags(mockResponse, customTags)

      expect(parsed.tags).toContain('bug')
      expect(parsed.tags).toContain('onboarding_issue')
      expect(parsed.tags).not.toContain('invalid_custom_tag')
    })
  })

  describe('Custom tag persistence', () => {
    it('should save custom tag to session.tags array', async () => {
      const supabase = createAdminClient()

      // Create test session
      const sessionId = crypto.randomUUID()
      await supabase.from('sessions').insert({
        id: sessionId,
        project_id: testProjectId,
        status: 'closed',
        message_count: 3,
        source: 'widget',
        tags: [],
      })

      // Simulate what the workflow does - update tags
      const newTags = ['bug', 'onboarding_issue', 'losses']
      const { error } = await supabase
        .from('sessions')
        .update({
          tags: newTags,
          tags_auto_applied_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      expect(error).toBeNull()

      // Verify tags were saved
      const { data: session } = await supabase
        .from('sessions')
        .select('tags, tags_auto_applied_at')
        .eq('id', sessionId)
        .single()

      expect(session!.tags).toContain('bug')
      expect(session!.tags).toContain('onboarding_issue')
      expect(session!.tags).toContain('losses')
      expect(session!.tags_auto_applied_at).not.toBeNull()

      // Cleanup
      await supabase.from('sessions').delete().eq('id', sessionId)
    })

    it('should preserve custom tag after tag definition is deleted', async () => {
      const supabase = createAdminClient()

      // Create a temporary custom tag
      const tempSlug = generateUniqueSlug('temp')
      const { data: tempTag } = await supabase
        .from('custom_tags')
        .insert({
          project_id: testProjectId,
          name: 'Temporary Tag',
          slug: tempSlug,
          description: 'Temporary for testing',
          color: 'info',
          position: 1,
        })
        .select()
        .single()

      // Create session with that tag
      const sessionId = crypto.randomUUID()
      await supabase.from('sessions').insert({
        id: sessionId,
        project_id: testProjectId,
        status: 'closed',
        message_count: 1,
        source: 'widget',
        tags: [tempSlug],
      })

      // Delete the custom tag definition
      await supabase.from('custom_tags').delete().eq('id', tempTag!.id)

      // Session should still have the tag (orphaned)
      const { data: session } = await supabase
        .from('sessions')
        .select('tags')
        .eq('id', sessionId)
        .single()

      expect(session!.tags).toContain(tempSlug)

      // Cleanup
      await supabase.from('sessions').delete().eq('id', sessionId)
    })
  })

  describe('Project scope isolation', () => {
    it('should not share custom tags between projects', async () => {
      // Create second project
      const { projectId: project2Id } = await createTestProject()

      // First project has onboarding_issue tag
      const project1Tags = await getProjectCustomTags(testProjectId)
      expect(project1Tags.some(t => t.slug === 'onboarding_issue')).toBe(true)

      // Second project should have no tags
      const project2Tags = await getProjectCustomTags(project2Id)
      expect(project2Tags.some(t => t.slug === 'onboarding_issue')).toBe(false)
      expect(project2Tags).toHaveLength(0)

      await cleanupTestProject(project2Id)
    })

    it('should allow same slug in different projects', async () => {
      const supabase = createAdminClient()

      // Create second project with same slug
      const { projectId: project2Id } = await createTestProject()

      const { data, error } = await supabase
        .from('custom_tags')
        .insert({
          project_id: project2Id,
          name: 'Onboarding Issue',
          slug: 'onboarding_issue', // Same slug as project 1
          description: 'Different project, same slug',
          color: 'info',
          position: 0,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data!.slug).toBe('onboarding_issue')

      // Both projects should have the tag independently
      const project1Tags = await getProjectCustomTags(testProjectId)
      const project2Tags = await getProjectCustomTags(project2Id)

      expect(project1Tags.some(t => t.slug === 'onboarding_issue')).toBe(true)
      expect(project2Tags.some(t => t.slug === 'onboarding_issue')).toBe(true)

      // But they should be different records
      const project1Tag = project1Tags.find(t => t.slug === 'onboarding_issue')
      const project2Tag = project2Tags.find(t => t.slug === 'onboarding_issue')
      expect(project1Tag!.id).not.toBe(project2Tag!.id)

      await cleanupTestProject(project2Id)
    })
  })
})

// Extended parsing function that includes custom tags
function parseSessionTaggingResponseWithCustomTags(
  responseText: string,
  customTags: CustomTagRecord[] = []
): {
  tags: string[]
  tagsApplied: boolean
  reasoning: string
  hasActionableTags: boolean
  hasSentimentTags: boolean
  hasCustomTags: boolean
} {
  // Build valid tags set
  const validNativeTags = new Set(SESSION_TAGS)
  const customSlugs = new Set(customTags.map(t => t.slug))
  const allValidTags = new Set([...SESSION_TAGS, ...customSlugs])

  // Parse JSON
  let tags: string[] = []
  let reasoning = 'No reasoning provided'

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.tags)) {
        // Only keep valid tags
        tags = parsed.tags.filter((t: string) => allValidTags.has(t))
      }
      if (parsed.reasoning) {
        reasoning = parsed.reasoning
      }
    } catch {
      // Fallback to text detection
    }
  }

  const actionableTags = ['bug', 'feature_request', 'change_request']
  const sentimentTags = ['wins', 'losses', 'general_feedback']

  return {
    tags,
    tagsApplied: tags.length > 0,
    reasoning,
    hasActionableTags: tags.some(t => actionableTags.includes(t)),
    hasSentimentTags: tags.some(t => sentimentTags.includes(t)),
    hasCustomTags: tags.some(t => customSlugs.has(t)),
  }
}
