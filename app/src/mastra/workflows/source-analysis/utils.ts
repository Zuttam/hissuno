/**
 * Strips common LLM preamble/introduction lines from agent output.
 * Agents sometimes prefix their response with text like
 * "Here is the sanitized content with sensitive information redacted:"
 */
export function stripLLMPreamble(text: string): string {
  return text
    .replace(
      /^(?:here(?:'s| is) (?:the )?(?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i,
      '',
    )
    .replace(/^(?:below is (?:the )?(?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i, '')
    .replace(/^(?:i'?ve (?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i, '')
    .trim()
}
