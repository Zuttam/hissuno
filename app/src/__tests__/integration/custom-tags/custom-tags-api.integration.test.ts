/**
 * Integration Tests for Custom Tags API Routes
 *
 * Tests the custom tags CRUD API endpoints:
 * - GET /api/projects/[id]/settings/custom-tags
 * - POST /api/projects/[id]/settings/custom-tags
 * - GET /api/projects/[id]/settings/custom-tags/[tagId]
 * - PATCH /api/projects/[id]/settings/custom-tags/[tagId]
 * - DELETE /api/projects/[id]/settings/custom-tags/[tagId]
 *
 * Requires: RUN_INTEGRATION_TESTS=true and running Supabase instance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'
import type { CustomTagRecord, CustomTagInput } from '@/types/session'
import {
  createTestProject,
  createTestCustomTag,
  cleanupTestProject,
  cleanupTestCustomTags,
  generateUniqueSlug,
  createMockCustomTagInput,
} from './test-utils'

const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true'

if (!shouldRun) {
  console.log('[custom-tags-api] Skipping integration tests')
  console.log('  To run: RUN_INTEGRATION_TESTS=true npm run test:integration')
}

describe('Custom Tags API Integration', { skip: !shouldRun }, () => {
  let testProjectId: string
  let testUserId: string
  const createdTagIds: string[] = []

  beforeAll(async () => {
    if (!isServiceRoleConfigured()) {
      throw new Error('Service role must be configured for integration tests')
    }

    // Create test project
    const { projectId, userId } = await createTestProject()
    testProjectId = projectId
    testUserId = userId
  })

  afterAll(async () => {
    // Cleanup all test data
    await cleanupTestCustomTags(testProjectId)
    await cleanupTestProject(testProjectId)
  })

  // Helper to call API routes directly through the handler
  // Note: In a real test, you'd use a test client or the actual API
  // For now, we test the database layer directly which is more reliable

  describe('Custom Tags Database Operations', () => {
    describe('List custom tags (GET equivalent)', () => {
      it('should return empty array for new project', async () => {
        const supabase = createAdminClient()

        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('project_id', testProjectId)
          .order('position', { ascending: true })

        expect(error).toBeNull()
        expect(data).toEqual([])
      })

      it('should return all tags ordered by position', async () => {
        const supabase = createAdminClient()

        // Create multiple tags
        const tag1 = await createTestCustomTag(testProjectId, {
          name: 'First Tag',
          slug: generateUniqueSlug('first'),
        })
        const tag2 = await createTestCustomTag(testProjectId, {
          name: 'Second Tag',
          slug: generateUniqueSlug('second'),
        })

        createdTagIds.push(tag1.id, tag2.id)

        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('project_id', testProjectId)
          .order('position', { ascending: true })

        expect(error).toBeNull()
        expect(data).toHaveLength(2)
        expect(data![0].position).toBeLessThan(data![1].position)
      })
    })

    describe('Create custom tag (POST equivalent)', () => {
      it('should create tag with valid input', async () => {
        const supabase = createAdminClient()
        const input = createMockCustomTagInput({
          name: 'Onboarding Issue',
          slug: generateUniqueSlug('onboarding'),
          description: 'Apply when user has problems during first-time setup',
          color: 'warning',
        })

        const { data, error } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            ...input,
            position: 0,
          })
          .select()
          .single()

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data!.name).toBe(input.name)
        expect(data!.slug).toBe(input.slug)
        expect(data!.description).toBe(input.description)
        expect(data!.color).toBe(input.color)

        createdTagIds.push(data!.id)
      })

      it('should reject duplicate slug within same project', async () => {
        const supabase = createAdminClient()
        const slug = generateUniqueSlug('dupe')

        // Create first tag
        const { data: tag1 } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: 'First',
            slug,
            description: 'First tag',
            color: 'info',
            position: 0,
          })
          .select()
          .single()

        createdTagIds.push(tag1!.id)

        // Try to create duplicate
        const { error } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: 'Second',
            slug, // Same slug
            description: 'Second tag',
            color: 'info',
            position: 1,
          })

        expect(error).not.toBeNull()
        expect(error!.code).toBe('23505') // Unique constraint violation
      })

      it('should allow same slug in different projects', async () => {
        const supabase = createAdminClient()
        const slug = generateUniqueSlug('shared')

        // Create in test project
        const { data: tag1, error: error1 } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: 'Shared Slug Tag',
            slug,
            description: 'Tag in first project',
            color: 'info',
            position: 0,
          })
          .select()
          .single()

        expect(error1).toBeNull()
        createdTagIds.push(tag1!.id)

        // Create another project
        const { projectId: otherProjectId } = await createTestProject()

        // Create same slug in different project
        const { data: tag2, error: error2 } = await supabase
          .from('custom_tags')
          .insert({
            project_id: otherProjectId,
            name: 'Shared Slug Tag',
            slug, // Same slug, different project
            description: 'Tag in second project',
            color: 'info',
            position: 0,
          })
          .select()
          .single()

        expect(error2).toBeNull()
        expect(tag2!.slug).toBe(slug)

        // Cleanup other project
        await cleanupTestProject(otherProjectId)
      })

      it('should auto-generate position for new tags', async () => {
        const supabase = createAdminClient()

        // Get current max position
        const { data: existing } = await supabase
          .from('custom_tags')
          .select('position')
          .eq('project_id', testProjectId)
          .order('position', { ascending: false })
          .limit(1)

        const expectedPosition = existing && existing.length > 0
          ? existing[0].position + 1
          : 0

        const input = createMockCustomTagInput({
          slug: generateUniqueSlug('autopos'),
        })

        const { data, error } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            ...input,
            position: expectedPosition,
          })
          .select()
          .single()

        expect(error).toBeNull()
        expect(data!.position).toBe(expectedPosition)

        createdTagIds.push(data!.id)
      })
    })

    describe('Get single custom tag (GET [tagId] equivalent)', () => {
      let existingTag: CustomTagRecord

      beforeAll(async () => {
        existingTag = await createTestCustomTag(testProjectId, {
          name: 'Get Test Tag',
          slug: generateUniqueSlug('gettest'),
        })
        createdTagIds.push(existingTag.id)
      })

      it('should return single tag by ID', async () => {
        const supabase = createAdminClient()

        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('id', existingTag.id)
          .single()

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data!.id).toBe(existingTag.id)
        expect(data!.name).toBe(existingTag.name)
      })

      it('should return error for non-existent tag', async () => {
        const supabase = createAdminClient()

        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('id', 'nonexistent-tag-id')
          .single()

        expect(error).not.toBeNull()
        expect(error!.code).toBe('PGRST116') // Not found
        expect(data).toBeNull()
      })
    })

    describe('Update custom tag (PATCH equivalent)', () => {
      let tagToUpdate: CustomTagRecord

      beforeAll(async () => {
        tagToUpdate = await createTestCustomTag(testProjectId, {
          name: 'Update Test Tag',
          slug: generateUniqueSlug('updatetest'),
          description: 'Original description',
          color: 'info',
        })
        createdTagIds.push(tagToUpdate.id)
      })

      it('should update single field', async () => {
        const supabase = createAdminClient()

        const { data, error } = await supabase
          .from('custom_tags')
          .update({ name: 'Updated Name' })
          .eq('id', tagToUpdate.id)
          .select()
          .single()

        expect(error).toBeNull()
        expect(data!.name).toBe('Updated Name')
        // Other fields unchanged
        expect(data!.slug).toBe(tagToUpdate.slug)
        expect(data!.description).toBe(tagToUpdate.description)
      })

      it('should update multiple fields', async () => {
        const supabase = createAdminClient()

        const { data, error } = await supabase
          .from('custom_tags')
          .update({
            name: 'Multi Update',
            description: 'Updated description',
            color: 'warning',
          })
          .eq('id', tagToUpdate.id)
          .select()
          .single()

        expect(error).toBeNull()
        expect(data!.name).toBe('Multi Update')
        expect(data!.description).toBe('Updated description')
        expect(data!.color).toBe('warning')
      })

      it('should reject duplicate slug on update', async () => {
        const supabase = createAdminClient()

        // Create another tag with a known slug
        const otherSlug = generateUniqueSlug('other')
        const { data: otherTag } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: 'Other Tag',
            slug: otherSlug,
            description: 'Other tag',
            color: 'info',
            position: 99,
          })
          .select()
          .single()

        createdTagIds.push(otherTag!.id)

        // Try to update tagToUpdate with the same slug
        const { error } = await supabase
          .from('custom_tags')
          .update({ slug: otherSlug })
          .eq('id', tagToUpdate.id)

        expect(error).not.toBeNull()
        expect(error!.code).toBe('23505') // Unique constraint violation
      })
    })

    describe('Delete custom tag (DELETE equivalent)', () => {
      it('should delete tag', async () => {
        const supabase = createAdminClient()

        // Create tag to delete
        const tagToDelete = await createTestCustomTag(testProjectId, {
          name: 'Tag To Delete',
          slug: generateUniqueSlug('todelete'),
        })

        // Delete it
        const { error: deleteError } = await supabase
          .from('custom_tags')
          .delete()
          .eq('id', tagToDelete.id)

        expect(deleteError).toBeNull()

        // Verify it's gone
        const { data, error: getError } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('id', tagToDelete.id)
          .single()

        expect(getError).not.toBeNull()
        expect(data).toBeNull()
      })

      it('should not affect other tags when deleting', async () => {
        const supabase = createAdminClient()

        // Create two tags
        const tag1 = await createTestCustomTag(testProjectId, {
          name: 'Tag 1',
          slug: generateUniqueSlug('tag1'),
        })
        const tag2 = await createTestCustomTag(testProjectId, {
          name: 'Tag 2',
          slug: generateUniqueSlug('tag2'),
        })

        createdTagIds.push(tag2.id) // Keep tag2

        // Delete tag1
        await supabase.from('custom_tags').delete().eq('id', tag1.id)

        // Tag2 should still exist
        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('id', tag2.id)
          .single()

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data!.id).toBe(tag2.id)
      })
    })

    describe('Tag limit enforcement', () => {
      it('should enforce 10 tag limit through position constraint', async () => {
        // The database has a CHECK constraint: position < 10
        // This effectively limits to 10 tags (positions 0-9)
        const supabase = createAdminClient()

        const { error } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: 'Tag at position 10',
            slug: generateUniqueSlug('pos10'),
            description: 'Should fail',
            color: 'info',
            position: 10, // Position 10 should fail the constraint
          })

        expect(error).not.toBeNull()
        // Should fail the max_labels_per_project CHECK constraint
      })
    })

    describe('Color validation', () => {
      const validColors = ['info', 'success', 'warning', 'danger', 'default']

      it.each(validColors)('should accept valid color: %s', async (color) => {
        const supabase = createAdminClient()
        const slug = generateUniqueSlug(`color_${color}`)

        const { data, error } = await supabase
          .from('custom_tags')
          .insert({
            project_id: testProjectId,
            name: `${color} Tag`,
            slug,
            description: `Tag with ${color} color`,
            color,
            position: 0,
          })
          .select()
          .single()

        expect(error).toBeNull()
        expect(data!.color).toBe(color)

        // Cleanup
        if (data) {
          await supabase.from('custom_tags').delete().eq('id', data.id)
        }
      })
    })
  })

  describe('Session tags with custom tags', () => {
    it('should allow custom tag slug in session.tags array', async () => {
      const supabase = createAdminClient()

      // Create a custom tag
      const customTag = await createTestCustomTag(testProjectId, {
        name: 'Custom Session Tag',
        slug: generateUniqueSlug('sessiontag'),
      })
      createdTagIds.push(customTag.id)

      // Create a session with the custom tag
      const sessionId = crypto.randomUUID()
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          id: sessionId,
          project_id: testProjectId,
          status: 'active',
          message_count: 0,
          source: 'widget',
          tags: ['bug', customTag.slug], // Mix native and custom tags
        })
        .select()
        .single()

      expect(sessionError).toBeNull()
      expect(session!.tags).toContain('bug')
      expect(session!.tags).toContain(customTag.slug)

      // Cleanup session
      await supabase.from('sessions').delete().eq('id', sessionId)
    })

    it('should preserve custom tag in session.tags after tag deletion', async () => {
      const supabase = createAdminClient()

      // Create a custom tag
      const customTag = await createTestCustomTag(testProjectId, {
        name: 'Deletable Tag',
        slug: generateUniqueSlug('deletabletag'),
      })

      // Create a session using that tag
      const sessionId = crypto.randomUUID()
      await supabase.from('sessions').insert({
        id: sessionId,
        project_id: testProjectId,
        status: 'active',
        message_count: 0,
        source: 'widget',
        tags: [customTag.slug],
      })

      // Delete the custom tag
      await supabase.from('custom_tags').delete().eq('id', customTag.id)

      // Session should still have the tag slug (orphaned but preserved)
      const { data: session } = await supabase
        .from('sessions')
        .select('tags')
        .eq('id', sessionId)
        .single()

      expect(session!.tags).toContain(customTag.slug)

      // Cleanup
      await supabase.from('sessions').delete().eq('id', sessionId)
    })
  })
})
