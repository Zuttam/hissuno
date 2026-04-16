'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { InstallCommand } from '@/components/landing/install-command'

interface Integration {
  name: string
  logo: string
}

const INTEGRATIONS: Integration[] = [
  { name: 'Slack', logo: '/logos/slack.svg' },
  { name: 'Jira', logo: '/logos/jira.svg' },
  { name: 'Gong', logo: '/logos/gong.svg' },
  { name: 'Linear', logo: '/logos/linear.svg' },
  { name: 'Intercom', logo: '/logos/intercom.svg' },
  { name: 'GitHub', logo: '/logos/github.svg' },
]

export function PMHeroSection() {
  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 md:px-12">
      <motion.div
        {...heroAnimation}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <p className="my-6 inline-block rounded-full border border-[var(--accent-teal)]/30 bg-[color-mix(in_srgb,var(--accent-teal)_10%,transparent)] px-4 py-1 font-mono text-xs text-[var(--accent-teal)]">
          Powered by the Hissuno Knowledge Graph
        </p>
        <h1 className="mt-6 font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Evidence-Backed Product Decisions,
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            On Autopilot
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          Your PM Co-Pilot traverses the knowledge graph to connect every customer signal to business outcomes. Know what drives revenue, stop guessing what to build.
        </p>

        {/* Integration logos row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
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
                  className="h-6 w-6 dark:invert"
                />
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4">
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
