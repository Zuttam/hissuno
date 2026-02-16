/**
 * MCP Server Authentication
 *
 * Resolves API key + optional contact JWT into an McpContext.
 * API key → project scope. JWT → contact scope within that project.
 */

import { resolveApiKey } from '@/lib/auth/api-keys'
import { verifyWidgetJWT } from '@/lib/utils/widget-auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { McpContext } from './context'

const LOG_PREFIX = '[mcp.auth]'

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'McpAuthError'
  }
}

/**
 * Authenticate an incoming MCP request.
 *
 * 1. Extract Bearer token (hiss_*) from Authorization header
 * 2. Resolve API key → projectId, keyId, createdByUserId
 * 3. If X-Contact-Token header present:
 *    a. Fetch project's secret_key
 *    b. Verify JWT
 *    c. Resolve contact from email in JWT payload
 *    d. Return contact context
 * 4. Otherwise return user context
 */
export async function authenticateRequest(headers: { get(name: string): string | null }): Promise<McpContext> {
  // Step 1: Extract API key
  const authHeader = headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new McpAuthError('Missing or invalid Authorization header', 401)
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "
  if (!apiKey.startsWith('hiss_')) {
    throw new McpAuthError('Invalid API key format', 401)
  }

  // Step 2: Resolve API key
  const keyResult = await resolveApiKey(apiKey)
  if (!keyResult) {
    throw new McpAuthError('Invalid or expired API key', 401)
  }

  const { keyId, projectId, createdByUserId } = keyResult

  // Step 3: Check for contact token
  const contactToken = headers.get('x-contact-token')
  if (typeof contactToken === 'string' && contactToken.length > 0) {
    return resolveContactContext(contactToken, projectId, keyId, createdByUserId)
  }

  // Step 4: User mode
  return { mode: 'user', projectId, keyId, createdByUserId }
}

/**
 * Resolve a contact JWT into a contact context.
 */
async function resolveContactContext(
  token: string,
  projectId: string,
  keyId: string,
  createdByUserId: string
): Promise<McpContext> {
  const supabase = createAdminClient()

  // Fetch project secret_key for JWT verification
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('secret_key')
    .eq('id', projectId)
    .single()

  if (projectError || !project?.secret_key) {
    console.error(`${LOG_PREFIX} Failed to fetch project secret_key`, projectId, projectError)
    throw new McpAuthError('Unable to verify contact token', 500)
  }

  // Verify JWT
  const verification = verifyWidgetJWT(token, project.secret_key)
  if (!verification.valid) {
    throw new McpAuthError(`Invalid contact token: ${verification.error}`, 401)
  }

  // Extract email from JWT payload
  const email =
    verification.payload.userMetadata?.email ?? verification.payload.userId
  if (!email) {
    throw new McpAuthError('Contact token missing email identifier', 401)
  }

  // Resolve contact from email within this project
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('project_id', projectId)
    .eq('email', email.toLowerCase())
    .single()

  if (contactError || !contact) {
    console.warn(`${LOG_PREFIX} Contact not found for email`, email, projectId)
    throw new McpAuthError('Contact not found', 404)
  }

  return {
    mode: 'contact',
    projectId,
    keyId,
    createdByUserId,
    contactId: contact.id,
    contactEmail: contact.email,
  }
}
