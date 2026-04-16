'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { InstallCommand } from '@/components/landing/install-command'


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
  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 pb-12 md:px-12">
      <motion.div
        {...heroAnimation}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl text-center">

        <h1 className="mt-12 font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Your Agents Don&apos;t Know Your Product.
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            We Built the Missing Layer.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          Hissuno builds the organizational knowledge layer your AI agents are missing - connecting customer signals, product goals, issues, docs, and codebase into one traversable graph.
        </p>

        {/* Integration logos row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.6 }}
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

        <div className="mt-10 flex flex-col items-center justify-center gap-4">
          <InstallCommand />
        </div>
      </motion.div>
    </section>
  )
}
