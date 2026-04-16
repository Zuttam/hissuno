/**
 * Runtime context type for the Hissuno Agent
 * Used by both widget chat routes and Slack integration
 */
export type SupportAgentContext = {
  projectId: string
  userId: string | null
  userMetadata: Record<string, string> | null
  sessionId: string
  /** Support package ID to use for this session */
  supportPackageId: string | null
  /** Contact ID for data tool scoping — null = user mode (full access), set = contact mode (scoped) */
  contactId: string | null
}
