'use client'

import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { Database, Sparkles, Terminal, LucideIcon } from 'lucide-react'
import { ThemeLogo } from '@/components/ui/theme-logo'
import { WaterReveal } from '@/components/landing/water-reveal'

interface FloatingIntegration {
  name: string
  logo?: string
  icon?: LucideIcon
  isHissuno?: boolean
  delay: number
}

interface Step {
  id: string
  step: number
  title: string
  description: string
  icon: LucideIcon
  integrations: FloatingIntegration[]
}

const STEPS: Step[] = [
  {
    id: 'connect',
    step: 1,
    title: 'Connect Sources',
    description:
      'Slack, Intercom, Gong, GitHub, email — connect the tools where product signals already live.',
    icon: Database,
    integrations: [
      { name: 'Slack', logo: '/logos/slack.svg', delay: 0 },
      { name: 'Intercom', logo: '/logos/intercom.svg', delay: 0.1 },
      { name: 'Gong', logo: '/logos/gong.svg', delay: 0.2 },
      { name: 'Gmail', logo: '/logos/gmail.svg', delay: 0.3 },
    ],
  },
  {
    id: 'analyze',
    step: 2,
    title: 'Build the Graph',
    description:
      'Hissuno comes with prebuilt agentic workflows that build your connected knowledge graph and enrich data intelligently.',
    icon: Sparkles,
    integrations: [
      { name: 'Hissuno', isHissuno: true, delay: 0 },
    ],
  },
  {
    id: 'expose',
    step: 3,
    title: 'Expose to Agents',
    description:
      'MCP, CLI, API - your AI agents traverse the graph and query product intelligence natively.',
    icon: Terminal,
    integrations: [
      { name: 'Anthropic', logo: '/logos/anthropic.svg', delay: 0 },
      { name: 'OpenAI', logo: '/logos/openai.svg', delay: 0.1 },
      { name: 'Terminal', icon: Terminal, delay: 0.2 },
    ],
  },
]

function FloatingLogo({ integration, index }: { integration: FloatingIntegration; index: number }) {
  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.3,
      }}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--surface)]/80 shadow-sm backdrop-blur-sm"
      title={integration.name}
    >
      {integration.isHissuno ? (
        <ThemeLogo width={96} height={32} className="h-8 w-auto" />
      ) : integration.logo ? (
        <Image
          src={integration.logo}
          alt={integration.name}
          width={18}
          height={18}
          className={integration.name === 'Gmail' || integration.name === 'Slack' || integration.name === 'Intercom' || integration.name === 'Gong' ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px] dark:invert'}
        />
      ) : integration.icon ? (
        <integration.icon className="h-[18px] w-[18px] text-[var(--accent-teal)]" />
      ) : null}
    </motion.div>
  )
}

function TimelineNode({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      {/* Floating logos above */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
        className="mb-4 flex items-center gap-2"
      >
        {step.integrations.map((integration, idx) => (
          <FloatingLogo key={integration.name} integration={integration} index={idx} />
        ))}
      </motion.div>

      {/* Numbered circle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--accent-teal)] bg-[var(--background)]"
      >
        <span className="font-mono text-lg font-bold text-[var(--accent-teal)]">{step.step}</span>
      </motion.div>

      {/* Title and description */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.4 + index * 0.15 }}
        className="mt-4 max-w-xs"
      >
        <h3 className="font-mono text-lg font-semibold text-[var(--foreground)]">{step.title}</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.description}</p>
      </motion.div>
    </div>
  )
}

function HorizontalTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <div ref={ref} className="relative hidden md:flex md:items-start">
      {/* Connecting line behind the circles */}
      <svg
        className="pointer-events-none absolute top-[106px] left-[16.67%] right-[16.67%] z-0 h-[2px] w-[66.66%]"
        preserveAspectRatio="none"
      >
        <motion.line
          x1="0"
          y1="1"
          x2="100%"
          y2="1"
          stroke="var(--accent-teal)"
          strokeWidth="2"
          strokeDasharray="8 6"
          initial={{ strokeDashoffset: 100 }}
          animate={isInView ? { strokeDashoffset: [100, 0] } : {}}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>

      {STEPS.map((step, index) => (
        <TimelineNode key={step.id} step={step} index={index} />
      ))}
    </div>
  )
}

function VerticalTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <div ref={ref} className="relative flex flex-col gap-12 md:hidden">
      {/* Vertical connecting line */}
      <svg
        className="pointer-events-none absolute top-[106px] bottom-[106px] left-6 z-0 w-[2px]"
        preserveAspectRatio="none"
        style={{ height: 'calc(100% - 212px)' }}
      >
        <motion.line
          x1="1"
          y1="0"
          x2="1"
          y2="100%"
          stroke="var(--accent-teal)"
          strokeWidth="2"
          strokeDasharray="8 6"
          initial={{ strokeDashoffset: 200 }}
          animate={isInView ? { strokeDashoffset: [200, 0] } : {}}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>

      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-start gap-5">
          {/* Numbered circle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.15 }}
            className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent-teal)] bg-[var(--background)]"
          >
            <span className="font-mono text-lg font-bold text-[var(--accent-teal)]">{step.step}</span>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 + index * 0.15 }}
            className="flex-1 pt-1"
          >
            {/* Floating logos */}
            <div className="mb-3 flex items-center gap-2">
              {step.integrations.map((integration, idx) => (
                <FloatingLogo key={integration.name} integration={integration} index={idx} />
              ))}
            </div>
            <h3 className="font-mono text-lg font-semibold text-[var(--foreground)]">{step.title}</h3>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{step.description}</p>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            How It Works
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            From scattered data to a traversable knowledge graph in three steps
          </p>
        </WaterReveal>

        <div className="mt-16">
          <HorizontalTimeline />
          <VerticalTimeline />
        </div>
      </div>
    </section>
  )
}
