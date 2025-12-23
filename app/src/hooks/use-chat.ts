'use client'

import { useCallback, useMemo, useState } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseChatOptions {
  projectId: string
  publicKey: string
  initialMessage?: string
}

interface UseChatState {
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  sendMessage: () => Promise<void>
  isLoading: boolean
  error: string | null
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useChat({ projectId, publicKey, initialMessage }: UseChatOptions): UseChatState {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessage) {
      return [
        {
          id: generateMessageId(),
          role: 'assistant',
          content: initialMessage,
        },
      ]
    }
    return []
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    setError(null)

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: trimmedInput,
    }

    // Create a placeholder for the assistant message
    const assistantMessageId = generateMessageId()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Prepare messages for the API (exclude the empty assistant placeholder)
      const apiMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          projectId,
          publicKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          typeof errorData?.error === 'string'
            ? errorData.error
            : 'Failed to get response from agent'
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error('No response body received')
      }

      // Read the streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk

        // Update the assistant message with accumulated content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        )
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unexpected error occurred'
      setError(errorMessage)

      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, projectId, publicKey])

  return useMemo(
    () => ({
      messages,
      input,
      setInput,
      sendMessage,
      isLoading,
      error,
    }),
    [messages, input, sendMessage, isLoading, error]
  )
}
