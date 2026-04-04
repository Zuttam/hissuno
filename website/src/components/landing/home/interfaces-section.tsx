'use client'

import { useState } from 'react'
import { Plug, Terminal, GraduationCap, LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { WaterReveal } from '@/components/landing/water-reveal'

interface AgentInterface {
  id: string
  title: string
  icon: LucideIcon
  code: string
}

const INTERFACES: AgentInterface[] = [
  {
    id: 'mcp',
    title: 'MCP Server',
    icon: Plug,
    code: `ask_hissuno, list_resources,
get_resource, search_resources,
add_resource, list_resource_types`,
  },
  {
    id: 'cli',
    title: 'CLI',
    icon: Terminal,
    code: `$ hissuno search "checkout issues"
$ hissuno list feedback --tag bug
$ hissuno get knowledge KB-12`,
  },
  {
    id: 'skills',
    title: 'Agent Skills',
    icon: GraduationCap,
    code: `skills/
  hissuno-product-intel.md
  hissuno-feedback-analyst.md
  hissuno-roadmap-planner.md`,
  },
]

export function InterfacesSection() {
  const [activeTab, setActiveTab] = useState('mcp')
  const active = INTERFACES.find((i) => i.id === activeTab)!

  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            <Terminal className="mr-2 inline-block h-7 w-7 align-middle text-[var(--accent-teal)]" />
            Agent-Native Interfaces
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Your agents don&apos;t need a browser. They traverse the graph directly.
          </p>
        </WaterReveal>

        <WaterReveal preset="card" delay={0.3}>
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
            {/* Terminal header */}
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              {/* Decorative dots */}
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {INTERFACES.map((iface) => (
                  <button
                    key={iface.id}
                    onClick={() => setActiveTab(iface.id)}
                    className={`relative rounded-md px-3 py-1.5 font-mono text-sm transition-colors ${
                      activeTab === iface.id
                        ? 'text-[var(--accent-teal)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <iface.icon className="mr-1.5 inline-block h-3.5 w-3.5 align-middle" />
                    {iface.title}
                    {activeTab === iface.id && (
                      <motion.div
                        layoutId="terminal-tab-underline"
                        className="absolute right-0 bottom-0 left-0 h-[2px] rounded-full bg-[var(--accent-teal)]"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal body */}
            <div className="min-h-[180px] p-6">
              <AnimatePresence mode="wait">
                <motion.pre
                  key={active.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-sm leading-relaxed text-[var(--text-secondary)]"
                >
                  {active.code}
                </motion.pre>
              </AnimatePresence>
            </div>
          </div>
        </WaterReveal>
      </div>
    </section>
  )
}
