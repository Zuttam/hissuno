'use client'

import Link from 'next/link'
import { MessageSquare, ClipboardList, Wrench } from 'lucide-react'
import { motion } from 'motion/react'

interface AgentRow {
  id: string
  icon: typeof MessageSquare
  headline: string
  description: string
  href: string
}

const AGENTS: AgentRow[] = [
  {
    id: 'your-agent',
    icon: Wrench,
    headline: 'Your Agent, Our Data',
    description:
      'Connect any AI agent to the graph via CLI or API. Build workflows on shared context.',
    href: '/docs',
  },
  {
    id: 'pm-copilot',
    icon: ClipboardList,
    headline: 'Product Intelligence on Autopilot',
    description:
      'Auto-triages feedback, creates issues, generates briefs by traversing the knowledge graph.',
    href: '/landing/pm-copilot',
  },
  {
    id: 'support-agent',
    icon: MessageSquare,
    headline: 'AI Support, Grounded in Your Product',
    description:
      'Resolves questions using product knowledge, codebase context, and customer history.',
    href: '/landing/support-agent',
  },
]

export function AgentsShowcaseSection() {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Built-In Agents, Powered by the Graph
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Production-ready agents that show what&apos;s possible when AI can traverse your entire product graph.
        </p>

        <div className="mt-16">
          {AGENTS.map((agent, index) => (
            <Link key={agent.id} href={agent.href} className="group block">
              <motion.div
                className={`flex items-center gap-5 px-2 py-6 transition-colors hover:bg-[var(--surface-hover)] md:gap-8 md:px-4 ${
                  index > 0 ? 'border-t border-[var(--border-subtle)]' : ''
                }`}
                whileHover="hover"
              >
                {/* Icon */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                >
                  <agent.icon className="h-6 w-6 text-[var(--accent-teal)]" />
                </div>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono text-lg font-semibold text-[var(--foreground)]">
                    {agent.headline}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {agent.description}
                  </p>
                </div>

                {/* Learn More arrow */}
                <span className="hidden shrink-0 items-center gap-1 font-mono text-sm font-medium text-[var(--accent-teal)] transition-colors group-hover:text-[var(--accent-teal-hover)] md:flex">
                  Learn More
                  <motion.span
                    variants={{ hover: { x: 4 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    aria-hidden="true"
                  >
                    →
                  </motion.span>
                </span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
