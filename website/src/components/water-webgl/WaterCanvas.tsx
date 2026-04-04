'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Dynamic import with SSR disabled for the actual canvas
const WaterCanvasInner = dynamic(
  () => import('./WaterCanvasInner').then((mod) => mod.WaterCanvasInner),
  { ssr: false }
)

export function WaterCanvas() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render nothing until mounted to avoid hydration mismatch
  // Browser extensions may inject content that causes mismatches
  if (!mounted) {
    return null
  }

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
      suppressHydrationWarning
    >
      <WaterCanvasInner />
    </div>
  )
}
