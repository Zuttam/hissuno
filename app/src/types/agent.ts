/**
 * Runtime context type for the support agent
 * Used by both widget chat routes and Slack integration
 */
export type SupportAgentContext = {
  projectId: string
  userId: string | null
  userMetadata: Record<string, string> | null
  sessionId: string
  /** Named knowledge package ID to use for this session */
  namedPackageId: string | null
  /** Contact JWT for MCP server contact-mode auth (generated from Slack user email) */
  contactToken: string | null
  /** Contact ID for data tool scoping — null = user mode (full access), set = contact mode (scoped) */
  contactId: string | null
}
