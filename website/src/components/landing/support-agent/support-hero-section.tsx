'use client'

import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { InstallCommand } from '@/components/landing/install-command'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { WATER_EASINGS } from '@/components/landing/scroll-animation-config'

export function SupportHeroSection() {
  const water = useWaterWebGLOptional()

  const handleCTAClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 md:px-12">
      {/* Atmospheric gradient for onsen atmosphere - light mode only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-0"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 20%, rgba(200, 228, 225, 0.4) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        {...heroAnimation}
        transition={{ duration: 1.2, ease: WATER_EASINGS.float, delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <p className="my-6 inline-block rounded-full border border-[var(--accent-teal)]/30 bg-[color-mix(in_srgb,var(--accent-teal)_10%,transparent)] px-4 py-1 font-mono text-xs text-[var(--accent-teal)]">
          Powered by the Hissuno Knowledge Graph
        </p>
        <h1 className="mt-6 font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Resolve Instantly,
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Retain Forever
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          The Hissuno Agent resolves questions instantly by traversing your product knowledge graph - codebase, docs, customer history - all interconnected and queryable.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4" onClick={handleCTAClick}>
          <InstallCommand />
          <a
            href="https://github.com/zuttam/hissuno"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              View on GitHub
            </Button>
          </a>
        </div>
      </motion.div>
    </section>
  )
}
