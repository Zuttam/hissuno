'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import type { ToolConfig } from './config'

interface EarlyAccessCTASectionProps {
  tool: ToolConfig
}

export function EarlyAccessCTASection({ tool }: EarlyAccessCTASectionProps) {
  const water = useWaterWebGLOptional()

  const handleButtonClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  return (
    <section className="relative px-6 py-24 md:px-12">
      {/* Gradient overlay for visual interest */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center, var(--accent-teal) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.h2
          className="font-mono text-3xl font-bold text-[var(--foreground)] md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Get back to building
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          We&apos;re working with a small group of founders to shape Hissuno. Get early access and
          help build the tool you wish existed.
        </motion.p>

        <motion.div
          className="mt-8 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link
            href={`/sign-up?utm_source=landing&utm_content=${tool.utmContent}`}
            onClick={handleButtonClick}
          >
            <Button
              size="lg"
              className="bg-[var(--accent-teal)] hover:bg-[var(--accent-teal-hover)]"
            >
              Request Early Access
            </Button>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--accent-teal)]">&#10003;</span>
              Free while in beta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--accent-teal)]">&#10003;</span>
              No credit card required
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
