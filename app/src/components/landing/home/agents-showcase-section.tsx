'use client'

import Link from 'next/link'
import { MessageSquare, ClipboardList, Code } from 'lucide-react'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

interface AgentCard {
  id: string
  icon: typeof MessageSquare
  headline: string
  description: string
  href: string
}

const AGENTS: AgentCard[] = [
  {
    id: 'support-agent',
    icon: MessageSquare,
    headline: 'Stop Answering the Same Questions',
    description:
      'Instant answers backed by your codebase. Web widget, Slack, email.',
    href: '/landing/support-agent',
  },
  {
    id: 'pm-copilot',
    icon: ClipboardList,
    headline: 'Your AI Product Manager',
    description:
      'Triage feedback, create issues, write specs. Focus on strategy, not busywork.',
    href: '/landing/pm-copilot',
  },
  {
    id: 'fde',
    icon: Code,
    headline: 'From Request to Pull Request',
    description:
      'Customer requests become code changes in hours, not weeks.',
    href: '/landing/fde',
  },
]

export function AgentsShowcaseSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Three Agents. One Platform.
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Choose the agent that fits your workflow, or use them all together.
          </p>
        </WaterReveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {AGENTS.map((agent, index) => (
            <WaterReveal
              key={agent.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <Link href={agent.href} className="block h-full">
                <FloatingCard
                  floating="gentle"
                  variant="elevated"
                  respondToRipple
                  className="group relative h-full cursor-pointer p-6 transition-colors hover:border-[var(--accent-teal)]"
                  style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
                >
                  {/* Icon */}
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg transition-colors group-hover:bg-[color-mix(in_srgb,var(--accent-teal)_20%,transparent)]"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                  >
                    <agent.icon className="h-6 w-6 text-[var(--accent-teal)]" />
                  </div>

                  <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                    {agent.headline}
                  </h3>
                  <p className="mt-3 text-[var(--text-secondary)]">
                    {agent.description}
                  </p>

                  {/* Learn More link */}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-teal)] transition-colors group-hover:text-[var(--accent-teal-hover)]">
                    Learn More
                    <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                      →
                    </span>
                  </span>
                </FloatingCard>
              </Link>
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
