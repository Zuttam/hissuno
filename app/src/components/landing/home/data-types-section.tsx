'use client'

import { MessageSquare, BookOpen, ClipboardList, Users, Activity, Lightbulb, LucideIcon } from 'lucide-react'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

interface DataType {
  id: string
  title: string
  description: string
  icon: LucideIcon
}

const DATA_TYPES: DataType[] = [
  {
    id: 'feedback',
    title: 'Feedback',
    description: 'Customer conversations classified, tagged, linked to contacts and issues.',
    icon: MessageSquare,
  },
  {
    id: 'knowledge',
    title: 'Product Knowledge',
    description: 'Codebase analysis, docs, specs — chunked, embedded, searchable.',
    icon: BookOpen,
  },
  {
    id: 'issues',
    title: 'Issues',
    description: 'Auto-created from feedback, prioritized by impact.',
    icon: ClipboardList,
  },
  {
    id: 'contacts',
    title: 'Contacts & CRM',
    description: 'Customer profiles with conversation history and company data.',
    icon: Users,
  },
  {
    id: 'signals',
    title: 'Behavioral Signals',
    description: 'Usage patterns, engagement trends, churn indicators.',
    icon: Activity,
  },
  {
    id: 'insights',
    title: 'Agent Insights',
    description: 'AI summaries, trend reports, recommendations.',
    icon: Lightbulb,
  },
]

export function DataTypesSection() {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Product Intelligence, Ready to Query
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Every data type analyzed, structured, and exposed through agent-native interfaces.
          </p>
        </WaterReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {DATA_TYPES.map((dataType, index) => (
            <WaterReveal
              key={dataType.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <FloatingCard
                floating="gentle"
                variant="elevated"
                respondToRipple
                className="h-full p-6"
                style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
              >
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                >
                  <dataType.icon className="h-6 w-6 text-[var(--accent-teal)]" />
                </div>

                <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                  {dataType.title}
                </h3>
                <p className="mt-2 text-[var(--text-secondary)]">{dataType.description}</p>
              </FloatingCard>
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
