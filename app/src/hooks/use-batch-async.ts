'use client'

import { useState, useCallback, useRef, useMemo } from 'react'

interface BatchResult {
  id: string
  success: boolean
  error?: string
}

interface BatchAsyncState {
  isRunning: boolean
  currentIndex: number
  total: number
  currentItemId: string | null
  results: BatchResult[]
  error: string | null
}

interface UseBatchAsyncReturn extends BatchAsyncState {
  executeBatch: <T extends { id: string }>(
    items: T[],
    executeFn: (item: T, signal: AbortSignal) => Promise<void>
  ) => Promise<BatchResult[]>
  cancel: () => void
}

const MAX_ASYNC_BATCH_SIZE = 20
const DELAY_BETWEEN_ITEMS_MS = 1000

export function useBatchAsync(): UseBatchAsyncReturn {
  const [state, setState] = useState<BatchAsyncState>({
    isRunning: false,
    currentIndex: 0,
    total: 0,
    currentItemId: null,
    results: [],
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const executeBatch = useCallback(async <T extends { id: string }>(
    items: T[],
    executeFn: (item: T, signal: AbortSignal) => Promise<void>
  ): Promise<BatchResult[]> => {
    if (items.length === 0) return []

    if (items.length > MAX_ASYNC_BATCH_SIZE) {
      setState((prev) => ({
        ...prev,
        error: `Maximum ${MAX_ASYNC_BATCH_SIZE} items per batch operation.`,
      }))
      return []
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const results: BatchResult[] = []

    setState({
      isRunning: true,
      currentIndex: 0,
      total: items.length,
      currentItemId: items[0].id,
      results: [],
      error: null,
    })

    try {
      for (let i = 0; i < items.length; i++) {
        if (controller.signal.aborted) break

        const item = items[i]
        setState((prev) => ({
          ...prev,
          currentIndex: i,
          currentItemId: item.id,
        }))

        try {
          await executeFn(item, controller.signal)
          results.push({ id: item.id, success: true })
        } catch (err) {
          if (controller.signal.aborted) break
          results.push({
            id: item.id,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }

        setState((prev) => ({ ...prev, results: [...results] }))

        // Delay between items to avoid rate limits (unless last item or cancelled)
        if (i < items.length - 1 && !controller.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_ITEMS_MS))
        }
      }
    } finally {
      abortControllerRef.current = null
      setState((prev) => ({
        ...prev,
        isRunning: false,
        currentItemId: null,
        results: [...results],
      }))
    }

    return results
  }, [])

  return useMemo(
    () => ({
      ...state,
      executeBatch,
      cancel,
    }),
    [state, executeBatch, cancel]
  )
}
