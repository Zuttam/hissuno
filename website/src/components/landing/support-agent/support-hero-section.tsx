'use client'

import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { InstallCommand } from '@/components/landing/install-command'

export function SupportHeroSection() {
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
          Resolve Instantly,
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Retain Forever
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          The Hissuno Agent resolves questions instantly by traversing your product knowledge graph - codebase, docs, customer history - all interconnected and queryable.
        </p>

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
