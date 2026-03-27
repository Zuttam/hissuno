'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { InstallCommand } from '@/components/landing/install-command'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { WATER_EASINGS } from '@/components/landing/scroll-animation-config'


interface Integration {
  name: string
  logo: string
}

const INTEGRATIONS: Integration[] = [
  { name: 'Slack', logo: '/logos/slack.svg' },
  { name: 'Gmail', logo: '/logos/gmail.svg' },
  { name: 'Linear', logo: '/logos/linear.svg' },
  { name: 'GitHub', logo: '/logos/github.svg' },
  { name: 'Intercom', logo: '/logos/intercom.svg' },
  { name: 'Gong', logo: '/logos/gong.svg' },
  { name: 'Jira', logo: '/logos/jira.svg' },
]

export function HeroSection() {
  const water = useWaterWebGLOptional()

  const handleCTAClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  // Hero uses timed animations (not scroll-triggered) since it's above the fold
  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 pb-12 md:px-12">
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
        className="relative z-10 mx-auto max-w-4xl text-center">

        <h1 className="mt-12 font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Your Agents Don&apos;t Know Your Product.
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Hissuno Fixes That.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          Hissuno builds the organizational knowledge layer your AI agents are missing - connecting customer signals, product goals, issues, docs, and codebase into one traversable graph.
        </p>

        {/* Integration logos row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: WATER_EASINGS.float, delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <span className="text-sm text-[var(--text-tertiary)]">Connects to your stack</span>
          <div className="flex items-center gap-4">
            {INTEGRATIONS.map((integration) => (
              <div
                key={integration.name}
                className="flex h-8 w-8 items-center justify-center opacity-60 transition-opacity hover:opacity-100"
                title={integration.name}
              >
                <Image
                  src={integration.logo}
                  alt={integration.name}
                  width={24}
                  height={24}
                  className={integration.name === 'Gmail' ? 'h-6 w-6' : 'h-6 w-6 dark:invert'}
                />
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4" onClick={handleCTAClick}>
          <InstallCommand />
        </div>
      </motion.div>
    </section>
  )
}
