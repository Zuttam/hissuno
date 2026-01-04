'use client'

import { useEffect, useState } from 'react'
import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export function PostEffects() {
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Detect theme changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }

    checkDarkMode()

    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  // Skip post-effects in light mode to preserve transparency
  if (!isDarkMode) {
    return null
  }

  return (
    <EffectComposer multisampling={0}>
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={0.3} darkness={0.2} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  )
}
