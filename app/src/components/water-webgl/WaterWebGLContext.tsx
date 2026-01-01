'use client'

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'

export interface RippleEvent {
  id: string
  x: number // Normalized -1 to 1 (viewport center = 0)
  y: number // Normalized -1 to 1
  clientX: number // Original viewport coords
  clientY: number // Original viewport coords
  timestamp: number
  strength: number // 0-1, based on interaction type
}

// Ripple speed in CSS pixels per second (matches shader: 280 framebuffer px/s at ~1.5 DPR)
const RIPPLE_SPEED_CSS_PX_PER_SEC = 190

interface RippleSubscriber {
  getRect: () => DOMRect
  callback: (event: RippleEvent, distance: number, angle: number) => void
}

interface WaterWebGLContextValue {
  // For the Canvas to read ripple data
  rippleEventsRef: React.RefObject<RippleEvent[]>

  // For UI to trigger ripples
  triggerRipple: (clientX: number, clientY: number, strength?: number) => void

  // For cards to subscribe to nearby ripples
  subscribeToRipples: (
    id: string,
    getRect: () => DOMRect,
    callback: (event: RippleEvent, distance: number, angle: number) => void
  ) => () => void
}

const WaterWebGLContext = createContext<WaterWebGLContextValue | null>(null)

export function WaterWebGLProvider({ children }: { children: ReactNode }) {
  const rippleEventsRef = useRef<RippleEvent[]>([])
  const subscribersRef = useRef<Map<string, RippleSubscriber>>(new Map())

  const triggerRipple = useCallback(
    (clientX: number, clientY: number, strength = 1) => {
      const vw = window.innerWidth
      const vh = window.innerHeight

      const event: RippleEvent = {
        id: `ripple-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        x: (clientX / vw) * 2 - 1, // Convert to normalized coords
        y: -((clientY / vh) * 2 - 1), // Flip Y for WebGL
        clientX,
        clientY,
        timestamp: Date.now(),
        strength,
      }

      rippleEventsRef.current = [...rippleEventsRef.current, event]

      // Notify subscribers with delay based on ripple travel time
      subscribersRef.current.forEach((sub) => {
        const rect = sub.getRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const dx = centerX - clientX
        const dy = centerY - clientY
        const distance = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)

        if (distance < 600) {
          // Calculate delay based on how long the ripple takes to reach the card
          const delayMs = (distance / RIPPLE_SPEED_CSS_PX_PER_SEC) * 1000
          setTimeout(() => {
            sub.callback(event, distance, angle)
          }, delayMs)
        }
      })

      // Cleanup old events after 3 seconds
      setTimeout(() => {
        rippleEventsRef.current = rippleEventsRef.current.filter(
          (e) => e.id !== event.id
        )
      }, 3000)
    },
    []
  )

  const subscribeToRipples = useCallback(
    (
      id: string,
      getRect: () => DOMRect,
      callback: (event: RippleEvent, distance: number, angle: number) => void
    ) => {
      subscribersRef.current.set(id, { getRect, callback })
      return () => {
        subscribersRef.current.delete(id)
      }
    },
    []
  )

  return (
    <WaterWebGLContext.Provider
      value={{ rippleEventsRef, triggerRipple, subscribeToRipples }}
    >
      {children}
    </WaterWebGLContext.Provider>
  )
}

export function useWaterWebGL() {
  const context = useContext(WaterWebGLContext)
  if (!context) {
    throw new Error('useWaterWebGL must be used within a WaterWebGLProvider')
  }
  return context
}

export function useWaterWebGLOptional() {
  return useContext(WaterWebGLContext)
}
