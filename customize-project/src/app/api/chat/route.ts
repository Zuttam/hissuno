import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Optional: Get authenticated user from Supabase
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Optional: Add user context to system message
    const systemMessage = user
      ? `You are a helpful assistant. User ID: ${user.id}`
      : 'You are a helpful assistant.'

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemMessage,
      messages,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
