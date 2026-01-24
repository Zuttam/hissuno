'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const FEATURES = [
  {
    id: 'knowledge',
    title: 'Agent-Ready Knowledge Base',
    description: 'High-fidelity documentation that powers AI agents and responds to natural language queries.',
    icon: '/file.svg',
    color: 'var(--accent-teal)',
    utmContent: 'knowledge',
  },
  {
    id: 'support-agent',
    title: 'AI Support Agent',
    description: 'Deploy intelligent support embedded in your website or Slack channels.',
    icon: '/logos/slack.svg',
    color: 'var(--accent-warm)',
    utmContent: 'support-agent',
  },
  {
    id: 'triage',
    title: 'Smart Conversation Triage',
    description: 'Automatically classify, prioritize, and route customer conversations.',
    icon: '/logos/linear.svg',
    color: 'var(--accent-coral)',
    utmContent: 'triage',
  },
  {
    id: 'issues',
    title: 'Issue & Action Tracking',
    description: 'Convert conversations into product tickets with automatic prioritization and deduplication.',
    icon: '/logos/jira.svg',
    color: 'var(--accent-selected)',
    utmContent: 'issues',
  },
  {
    id: 'specs',
    title: 'Connected Product Specs',
    description: 'Generate specs linked to customer conversations and your codebase.',
    icon: '/window.svg',
    color: 'var(--accent-teal)',
    utmContent: 'specs',
  },
  {
    id: 'coding-agent',
    title: 'Bring Your Own Agent',
    description: 'Use our native coding agent or integrate with Claude, Cursor, or your preferred tool.',
    icon: '/logos/github.svg',
    color: 'var(--accent-selected)',
    utmContent: 'coding-agent',
  },
]

export function FeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Everything You Need, One Platform
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Six powerful capabilities that replace your entire customer intelligence stack
          </p>
        </WaterReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <WaterReveal
              key={feature.id}
              preset="card"
              staggerIndex={index}
              stagger="organic"
            >
              <Link
                href={`/sign-up?utm_content=${feature.utmContent}`}
                className="block h-full"
              >
                <FloatingCard
                  floating="gentle"
                  variant="elevated"
                  respondToRipple
                  className="h-full cursor-pointer p-6 transition-colors hover:border-[var(--accent-teal)]"
                  style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
                >
                  <div
                    className="inline-flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)` }}
                  >
                    <Image
                      src={feature.icon}
                      alt=""
                      width={28}
                      height={28}
                      className="opacity-80"
                    />
                  </div>
                  <h3 className="mt-4 font-mono text-xl font-semibold text-[var(--foreground)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">{feature.description}</p>
                </FloatingCard>
              </Link>
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
