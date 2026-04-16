'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { FloatingCard } from '@/components/ui/floating-card'

const SLACK_INVITE_URL =
  'https://join.slack.com/t/hissuno/shared_invite/zt-3miqrr3f6-~E6eKM4Mgk1oZwUGMy6mTg'

export function CommunitySection() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-4xl">
        <a href={SLACK_INVITE_URL} target="_blank" rel="noopener noreferrer" className="block">
          <FloatingCard
            floating="moderate"
            variant="elevated"
            className="flex cursor-pointer flex-col items-center gap-4 p-8 text-center transition-colors hover:border-[var(--accent-teal)] md:flex-row md:text-left"
          >
            <motion.div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'color-mix(in srgb, #4A154B 15%, transparent)' }}
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Image src="/logos/slack.svg" alt="Slack" width={40} height={40} />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-mono text-lg font-semibold text-[var(--foreground)]">
                Join our Slack community
              </h3>
              <p className="mt-1 text-[var(--text-secondary)]">
                Connect with other teams using Hissuno, share feedback, and get help from our team.
              </p>
            </div>
            <motion.span
              className="flex-shrink-0 font-semibold text-[var(--accent-teal)]"
              whileHover={{ x: 5 }}
            >
              Join now &rarr;
            </motion.span>
          </FloatingCard>
        </a>
      </div>
    </section>
  )
}
