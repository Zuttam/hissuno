'use client'

import { motion } from 'motion/react'
import { Zap, ShieldCheck, Network, LucideIcon } from 'lucide-react'
import { FloatingCard } from '@/components/ui/floating-card'

interface Capability {
  id: string
  title: string
  description: string
  icon: LucideIcon
}

const CAPABILITIES: Capability[] = [
  {
    id: 'triggers',
    title: 'Trigger on anything',
    description:
      'Manual, scheduled, or event-driven. New feedback tagged "bug". A Linear status change. A nightly digest. Declared in frontmatter.',
    icon: Zap,
  },
  {
    id: 'sandbox',
    title: 'Sandboxed by default',
    description:
      'Each skill runs in an isolated environment with scoped credentials. Per-plugin tokens are injected at runtime, never in code.',
    icon: ShieldCheck,
  },
  {
    id: 'graph',
    title: 'Built on the graph',
    description:
      'Skills traverse the same knowledge graph your agents use. Feedback, issues, contacts, codebase, scopes - one query away.',
    icon: Network,
  },
]

const SKILL_EXAMPLE = `---
name: triage-bug-reports
description: Triage new bug feedback into Linear with codebase context
trigger:
  on: feedback.tagged
  filter:
    tags: [bug]
capabilities:
  sandbox: true
  webSearch: false
---

When new bug feedback arrives:
1. Pull the feedback and linked contact.
2. Search the codebase for related modules.
3. Score impact using ARR-weighted customer data.
4. Open a Linear issue with the spec and code refs.
5. Post a summary to #product-triage in Slack.`

export function AutomationsSection() {
  return (
    <section id="automations" className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-teal)]">
            The runtime
          </p>
          <h2 className="mt-3 font-mono text-3xl font-bold text-[var(--foreground)]">
            Skills that run when your graph changes.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
            Hissuno isn&apos;t a passive store. Drop a SKILL.md in your project and it runs on a trigger - new feedback, a scheduled cadence, a webhook from any connected tool - with full graph access and a sandboxed environment.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CAPABILITIES.map((capability, index) => (
            <FloatingCard
              key={capability.id}
              floating="gentle"
              variant="elevated"
              className="h-full p-6"
              style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
              >
                <capability.icon className="h-6 w-6 text-[var(--accent-teal)]" />
              </div>

              <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                {capability.title}
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">{capability.description}</p>
            </FloatingCard>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]"
        >
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              .claude/skills/triage-bug-reports/SKILL.md
            </span>
          </div>

          <pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed text-[var(--text-secondary)]">
            {SKILL_EXAMPLE}
          </pre>
        </motion.div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-[var(--text-tertiary)]">
          One file. Drops into your repo. Runs in production on the trigger you define.
        </p>

        <div className="mt-8 flex justify-center">
          <a
            href="/docs/architecture/plugin-system"
            className="font-mono text-sm text-[var(--accent-teal)] transition-colors hover:text-[var(--accent-teal-hover)]"
          >
            Read the automations docs →
          </a>
        </div>
      </div>
    </section>
  )
}
