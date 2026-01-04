'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { WaterPlane } from './WaterPlane'
import { PostEffects } from './PostEffects'
import { useWaterWebGL } from './WaterWebGLContext'

export function WaterCanvasInner() {
  const { triggerRipple } = useWaterWebGL()
  const lastRippleRef = useRef<number>(0)

  // Global click handler for ripples
  useEffect(() => {
    const RIPPLE_COOLDOWN = 100 // ms between ripples

    const handleClick = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastRippleRef.current < RIPPLE_COOLDOWN) return

      const target = e.target as Element
      // Skip interactive elements
      if (
        target.closest(
          'button, a, input, textarea, select, [role="button"], [data-no-ripple]'
        )
      ) {
        return
      }
      lastRippleRef.current = now
      triggerRipple(e.clientX, e.clientY, 1.0)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastRippleRef.current < RIPPLE_COOLDOWN) return

      const touch = e.changedTouches[0]
      if (!touch) return
      const target = e.target as Element
      if (
        target.closest(
          'button, a, input, textarea, select, [role="button"], [data-no-ripple]'
        )
      ) {
        return
      }
      lastRippleRef.current = now
      triggerRipple(touch.clientX, touch.clientY, 0.8)
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [triggerRipple])

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      frameloop="always"
      style={{
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <WaterPlane />
      <PostEffects />
    </Canvas>
  )
}
