'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Button, ThemeLogo } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { useCTA } from '@/components/landing/cta-context'

export function HeroSection() {
  const water = useWaterWebGLOptional()
  const { openCTAOptions } = useCTA()

  const handleLogoClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  const handleCTAClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
    openCTAOptions('hero')
  }

  return (
    <section className="relative overflow-hidden px-6 py-8 md:px-12 md:py-12">
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Interactive logo that triggers ripples */}
        <motion.div
          className="mx-auto mb-8 w-fit cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogoClick}
        >
          <ThemeLogo width={180} height={60} priority />
        </motion.div>

        <h1 className="font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Turn Customer Conversations into
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Engineering Work
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          Hissuno is an AI-powered customer intelligence platform that turns customer conversations
          into actionable issues, product specs, and shipped code — without the tool sprawl.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            onClick={handleCTAClick}
            className="w-full bg-[var(--accent-selected)] hover:opacity-90 sm:w-auto"
          >
            Get Started
          </Button>
        </div>
      </div>
    </section>
  )
}
