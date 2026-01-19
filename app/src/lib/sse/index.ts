/**
 * Shared SSE (Server-Sent Events) utilities for streaming responses.
 *
 * This module provides reusable infrastructure for SSE endpoints including:
 * - Event formatting and serialization
 * - Safe stream controller management
 * - Standard SSE headers
 *
 * Usage:
 * ```ts
 * const { stream, emit, close } = createSSEStream({ logPrefix: '[my-endpoint]' })
 *
 * emit({ type: 'connected', message: 'Connected' })
 * // ... do work, emit more events ...
 * emit({ type: 'complete', message: 'Done' })
 * close()
 *
 * return createSSEResponse(stream)
 * ```
 */

/**
 * Base SSE event structure.
 * Extend this for domain-specific events.
 */
export interface BaseSSEEvent {
  type: string
  stepId?: string
  stepName?: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}

/**
 * Common SSE event types shared across streams
 */
export type CommonSSEEventType =
  | 'connected'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'error'

/**
 * Format an event as SSE message format.
 * Uses explicit event type for better browser compatibility.
 */
export function formatSSE<T extends BaseSSEEvent>(event: T): string {
  return `event: message\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * Create an SSE event with automatic timestamp
 */
export function createSSEEvent<T extends string>(
  type: T,
  options: Omit<BaseSSEEvent, 'type' | 'timestamp'> = {}
): BaseSSEEvent & { type: T } {
  return {
    type,
    ...options,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Standard SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

/**
 * Create CORS headers for widget-facing SSE endpoints
 */
export function createCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/**
 * Create an SSE Response with standard headers
 */
export function createSSEResponse(
  stream: ReadableStream,
  additionalHeaders?: Record<string, string>
): Response {
  const headers = additionalHeaders
    ? { ...SSE_HEADERS, ...additionalHeaders }
    : SSE_HEADERS
  return new Response(stream, { headers })
}

/**
 * Options for creating an SSE stream
 */
export interface CreateSSEStreamOptions {
  /** Prefix for log messages (e.g., '[pm-review.stream]') */
  logPrefix?: string
}

/**
 * SSE stream controller returned by createSSEStream
 */
export interface SSEStreamController<T extends BaseSSEEvent = BaseSSEEvent> {
  /** The ReadableStream to return in the Response */
  stream: ReadableStream
  /** Emit an SSE event to the client */
  emit: (event: T) => void
  /** Safely close the stream */
  close: () => void
  /** Check if the stream is closed */
  isClosed: () => boolean
}

/**
 * Create an SSE stream with safe event emission and closure.
 *
 * Returns a controller object with:
 * - `stream`: The ReadableStream to pass to createSSEResponse()
 * - `emit`: Function to safely emit events
 * - `close`: Function to safely close the stream
 * - `isClosed`: Function to check if stream is closed
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const { stream, emit, close } = createSSEStream<MyEventType>({
 *     logPrefix: '[my-endpoint]'
 *   })
 *
 *   // Use in an async context
 *   ;(async () => {
 *     emit(createSSEEvent('connected', { message: 'Connected' }))
 *     // ... do work ...
 *     emit(createSSEEvent('complete', { message: 'Done' }))
 *     close()
 *   })()
 *
 *   return createSSEResponse(stream)
 * }
 * ```
 */
export function createSSEStream<T extends BaseSSEEvent = BaseSSEEvent>(
  options: CreateSSEStreamOptions = {}
): SSEStreamController<T> {
  const { logPrefix = '[sse]' } = options
  const encoder = new TextEncoder()

  let isClosed = false
  let controllerRef: ReadableStreamDefaultController | null = null

  // Events that should not be logged (too noisy)
  const silentEvents = new Set(['text-chunk', 'heartbeat', 'text-delta', 'message-chunk'])

  const safeEnqueue = (data: Uint8Array, eventType?: string) => {
    if (!isClosed && controllerRef) {
      try {
        controllerRef.enqueue(data)
        // Only log meaningful events, not streaming chunks
        if (!silentEvents.has(eventType ?? '')) {
          console.debug(`${logPrefix} Enqueued event:`, eventType ?? 'unknown')
        }
      } catch (enqueueError) {
        console.error(`${logPrefix} Failed to enqueue:`, enqueueError)
        isClosed = true
      }
    }
  }

  const safeClose = () => {
    if (!isClosed && controllerRef) {
      isClosed = true
      try {
        controllerRef.close()
      } catch {
        // Already closed
      }
    }
  }

  const emit = (event: T) => {
    safeEnqueue(encoder.encode(formatSSE(event)), event.type)
  }

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller
    },
  })

  return {
    stream,
    emit,
    close: safeClose,
    isClosed: () => isClosed,
  }
}

/**
 * Create an SSE stream with async execution support.
 *
 * This is a higher-level helper that wraps createSSEStream with an
 * async executor function, handling errors automatically.
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   return createSSEStreamWithExecutor<MyEventType>({
 *     logPrefix: '[my-endpoint]',
 *     executor: async ({ emit, close, isClosed }) => {
 *       emit(createSSEEvent('connected', { message: 'Connected' }))
 *
 *       try {
 *         // Do async work...
 *         emit(createSSEEvent('complete', { message: 'Done' }))
 *       } catch (error) {
 *         emit(createSSEEvent('error', { message: 'Failed' }))
 *       }
 *
 *       close()
 *     },
 *   })
 * }
 * ```
 */
export function createSSEStreamWithExecutor<T extends BaseSSEEvent = BaseSSEEvent>(options: {
  logPrefix?: string
  executor: (controller: Omit<SSEStreamController<T>, 'stream'>) => Promise<void>
  /** Additional headers to include in the response (e.g., CORS headers) */
  headers?: Record<string, string>
}): Response {
  const { logPrefix = '[sse]', executor, headers } = options
  const encoder = new TextEncoder()

  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Events that should not be logged (too noisy)
      const silentEvents = new Set(['text-chunk', 'heartbeat', 'text-delta', 'message-chunk'])

      const safeEnqueue = (data: Uint8Array, eventType?: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(data)
            // Only log meaningful events, not streaming chunks
            if (!silentEvents.has(eventType ?? '')) {
              console.log(`${logPrefix} Enqueued event:`, eventType ?? 'unknown')
            }
          } catch (enqueueError) {
            console.error(`${logPrefix} Failed to enqueue:`, enqueueError)
            isClosed = true
          }
        }
      }

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true
          try {
            controller.close()
          } catch {
            // Already closed
          }
        }
      }

      const emit = (event: T) => {
        safeEnqueue(encoder.encode(formatSSE(event)), event.type)
      }

      try {
        await executor({
          emit,
          close: safeClose,
          isClosed: () => isClosed,
        })
      } catch (error) {
        console.error(`${logPrefix} Executor error:`, error)
        // Emit error event if stream is still open
        emit({
          type: 'error',
          message: 'An unexpected error occurred.',
          timestamp: new Date().toISOString(),
        } as T)
        safeClose()
      }
    },
  })

  return createSSEResponse(stream, headers)
}
