'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { WaterPlane } from './WaterPlane'
import { PostEffects } from './PostEffects'
import { useWaterWebGL } from './WaterWebGLContext'

const DESKTOP_BREAKPOINT = 768

export function WaterCanvasInner() {
  const { triggerRipple, clickRipplesEnabled } = useWaterWebGL()
  const lastRippleRef = useRef<number>(0)

  // Global click handler for ripples (desktop marketing pages only)
  useEffect(() => {
    // Skip if click ripples are disabled
    if (!clickRipplesEnabled) return

    // Only enable on desktop
    if (window.innerWidth <= DESKTOP_BREAKPOINT) return

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

    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [triggerRipple, clickRipplesEnabled])

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
