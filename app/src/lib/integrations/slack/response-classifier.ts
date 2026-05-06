import { Agent } from '@mastra/core/agent'
import { resolveModel, type ModelConfig } from '@/mastra/models'
import type { SlackMessage } from './client'

const RESPONSE_CLASSIFIER_MODEL: ModelConfig = {
  name: 'response-classifier',
  tier: 'small',
  fallback: 'openai/gpt-5.4-mini',
}

const INSTRUCTIONS = `
You analyze messages in support threads to determine if they are directed at the support bot and expect a response.

## Decision Criteria

**RESPOND when:**
- The message is a question asking for help or information
- The message is a follow-up to a previous bot response
- The message appears to be directed at the support bot
- The user is continuing a support conversation
- The message contains a problem or request that needs assistance

**SKIP when:**
- The message is directed at another human in the thread (e.g., "Hey John, can you check this?")
- The message is an internal discussion between team members
- The message is just an acknowledgment or thanks that doesn't need a reply
- The message indicates someone else is taking over (e.g., "I'll handle this")
- The message is a side conversation not related to the support topic

## Response Format

Respond with exactly one word on the first line: "RESPOND" or "SKIP"
Then optionally add a brief reason on the next line.
`

export async function classifyShouldRespond(input: {
  text: string
  threadHistory?: SlackMessage[]
}): Promise<{ shouldRespond: boolean; reason: string }> {
  const recentHistory =
    input.threadHistory?.slice(-5).map((msg) => `${msg.user}: ${msg.text}`).join('\n') || ''

  const prompt = `Analyze if this message in a support thread is directed at the support bot (Hissuno) and expects a response.

${recentHistory ? `Recent thread context:\n${recentHistory}\n\n` : ''}Latest message: "${input.text}"

Consider:
- Is this a question or request that needs a response?
- Is this directed at someone else (another human in the thread)?
- Is this just a comment or acknowledgment that doesn't need a reply?
- Is the user asking for help or information?

Respond with only "RESPOND" or "SKIP" followed by a brief reason.`

  const agent = new Agent({
    id: 'response-classifier',
    name: 'Response Classifier',
    instructions: INSTRUCTIONS,
    model: ({ requestContext }) => resolveModel(RESPONSE_CLASSIFIER_MODEL, requestContext),
  })

  const result = await agent.generate([{ role: 'user', content: prompt }])
  const text = result.text?.trim() ?? ''
  const shouldRespond = text.toUpperCase().startsWith('RESPOND')
  const reason = text.split('\n')[0] || 'Classifier decision'
  return { shouldRespond, reason }
}
