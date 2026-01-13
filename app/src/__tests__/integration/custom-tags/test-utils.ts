/**
 * Test Utilities for Custom Tags Integration Tests
 *
 * Provides helper functions for:
 * - Creating test projects and custom tags
 * - Mock data factories
 * - Cleanup operations
 */

import type { CustomTagRecord, CustomTagInput } from '@/types/session'
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'

// Track created resources for cleanup
const createdProjectIds: string[] = []
const createdTagIds: string[] = []

/**
 * Generate a unique slug for testing
 */
export function generateUniqueSlug(prefix: string = 'test'): string {
  const random = Math.random().toString(36).substring(2, 10)
  const timestamp = Date.now().toString(36)
  return `${prefix}_${random}_${timestamp}`
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  const random = Math.random().toString(36).substring(2, 15)
  return `${prefix}-${random}-${Date.now()}`
}

/**
 * Create a mock CustomTagInput for testing
 */
export function createMockCustomTagInput(overrides: Partial<CustomTagInput> = {}): CustomTagInput {
  const slug = overrides.slug || generateUniqueSlug('tag')
  return {
    name: overrides.name || `Test Tag ${slug}`,
    slug,
    description: overrides.description || `Test description for ${slug}. Apply when testing.`,
    color: overrides.color || 'info',
  }
}

/**
 * Create a mock CustomTagRecord for testing (without database)
 */
export function createMockCustomTagRecord(
  projectId: string,
  overrides: Partial<CustomTagRecord> = {}
): CustomTagRecord {
  const id = overrides.id || crypto.randomUUID()
  const slug = overrides.slug || generateUniqueSlug('tag')
  const now = new Date().toISOString()

  return {
    id,
    project_id: projectId,
    name: overrides.name || `Test Tag ${slug}`,
    slug,
    description: overrides.description || `Test description for ${slug}`,
    color: overrides.color || 'info',
    position: overrides.position ?? 0,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  }
}

/**
 * Create a test project in the database
 * Returns the project ID and a test user ID
 */
export async function createTestProject(): Promise<{ projectId: string; userId: string }> {
  if (!isServiceRoleConfigured()) {
    throw new Error('Service role must be configured for integration tests')
  }

  const supabase = createAdminClient()

  // Create a test user (or use existing test user)
  const testEmail = `test-${Date.now()}@hissuno-test.local`
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  })

  if (authError) {
    throw new Error(`Failed to create test user: ${authError.message}`)
  }

  const userId = authUser.user.id

  // Create a test project
  const projectId = crypto.randomUUID()
  const { error: projectError } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: `Test Project ${Date.now()}`,
      codebase_id: null,
    })

  if (projectError) {
    // Cleanup user on failure
    await supabase.auth.admin.deleteUser(userId)
    throw new Error(`Failed to create test project: ${projectError.message}`)
  }

  // Track for cleanup
  createdProjectIds.push(projectId)

  return { projectId, userId }
}

/**
 * Create a custom tag in the database for testing
 */
export async function createTestCustomTag(
  projectId: string,
  input?: Partial<CustomTagInput>
): Promise<CustomTagRecord> {
  if (!isServiceRoleConfigured()) {
    throw new Error('Service role must be configured for integration tests')
  }

  const supabase = createAdminClient()
  const tagInput = createMockCustomTagInput(input)

  // Get next position
  const { data: existingTags } = await supabase
    .from('custom_tags')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingTags && existingTags.length > 0
    ? existingTags[0].position + 1
    : 0

  const { data, error } = await supabase
    .from('custom_tags')
    .insert({
      project_id: projectId,
      name: tagInput.name,
      slug: tagInput.slug,
      description: tagInput.description,
      color: tagInput.color,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test custom tag: ${error.message}`)
  }

  // Track for cleanup
  createdTagIds.push(data.id)

  return data as CustomTagRecord
}

/**
 * Create multiple test custom tags
 */
export async function createTestCustomTags(
  projectId: string,
  count: number
): Promise<CustomTagRecord[]> {
  const tags: CustomTagRecord[] = []
  for (let i = 0; i < count; i++) {
    const tag = await createTestCustomTag(projectId, {
      name: `Test Tag ${i + 1}`,
      slug: generateUniqueSlug(`tag${i + 1}`),
      description: `Description for test tag ${i + 1}`,
      color: ['info', 'success', 'warning', 'danger', 'default'][i % 5] as CustomTagInput['color'],
    })
    tags.push(tag)
  }
  return tags
}

/**
 * Clean up custom tags for a project
 */
export async function cleanupTestCustomTags(projectId: string): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('custom_tags')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error(`[test-utils] Failed to cleanup custom tags: ${error.message}`)
  }
}

/**
 * Clean up a test project and its associated data
 */
export async function cleanupTestProject(projectId: string): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return
  }

  const supabase = createAdminClient()

  // Get user ID before deleting project
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  // Delete custom tags first
  await cleanupTestCustomTags(projectId)

  // Delete sessions and messages
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('project_id', projectId)

  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id)
    await supabase.from('messages').delete().in('session_id', sessionIds)
    await supabase.from('sessions').delete().eq('project_id', projectId)
  }

  // Delete project
  const { error: projectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (projectError) {
    console.error(`[test-utils] Failed to cleanup project: ${projectError.message}`)
  }

  // Delete test user
  if (project?.user_id) {
    const { error: userError } = await supabase.auth.admin.deleteUser(project.user_id)
    if (userError) {
      console.error(`[test-utils] Failed to cleanup user: ${userError.message}`)
    }
  }

  // Remove from tracking
  const idx = createdProjectIds.indexOf(projectId)
  if (idx > -1) {
    createdProjectIds.splice(idx, 1)
  }
}

/**
 * Clean up all tracked test resources
 * Call this in afterAll() as a safety net
 */
export async function cleanupAllTestResources(): Promise<void> {
  for (const projectId of [...createdProjectIds]) {
    await cleanupTestProject(projectId)
  }
}

/**
 * Create a test session in a project
 */
export async function createTestSession(
  projectId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ sessionId: string }> {
  if (!isServiceRoleConfigured()) {
    throw new Error('Service role must be configured for integration tests')
  }

  const supabase = createAdminClient()
  const sessionId = crypto.randomUUID()

  const { error } = await supabase
    .from('sessions')
    .insert({
      id: sessionId,
      project_id: projectId,
      status: 'closed',
      message_count: 0,
      source: 'widget',
      ...overrides,
    })

  if (error) {
    throw new Error(`Failed to create test session: ${error.message}`)
  }

  return { sessionId }
}

/**
 * Create test messages for a session
 */
export async function createTestMessages(
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    throw new Error('Service role must be configured for integration tests')
  }

  const supabase = createAdminClient()

  const messageRecords = messages.map((msg, index) => ({
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
    created_at: new Date(Date.now() + index * 1000).toISOString(),
  }))

  const { error } = await supabase.from('messages').insert(messageRecords)

  if (error) {
    throw new Error(`Failed to create test messages: ${error.message}`)
  }

  // Update session message count
  await supabase
    .from('sessions')
    .update({ message_count: messages.length })
    .eq('id', sessionId)
}

/**
 * Clean up a test session and its messages
 */
export async function cleanupTestSession(sessionId: string): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return
  }

  const supabase = createAdminClient()

  await supabase.from('messages').delete().eq('session_id', sessionId)
  await supabase.from('sessions').delete().eq('id', sessionId)
}

/**
 * Validate custom tag colors
 */
export const VALID_TAG_COLORS = ['info', 'success', 'warning', 'danger', 'default'] as const
export type ValidTagColor = (typeof VALID_TAG_COLORS)[number]

export function isValidTagColor(color: string): color is ValidTagColor {
  return VALID_TAG_COLORS.includes(color as ValidTagColor)
}
