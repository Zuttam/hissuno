/**
 * Runtime context type for the support agent
 * Used by both widget chat routes and Slack integration
 */
export type SupportAgentContext = {
  projectId: string
  userId: string | null
  userMetadata: Record<string, string> | null
  sessionId: string
}
