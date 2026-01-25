'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { MessageSquare, GitBranch, FileCode, LucideIcon, BookOpen } from 'lucide-react'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

interface Step {
  id: string
  step: number
  title: string
  description: string
  icon: LucideIcon
  integrations: FloatingIntegration[]
  flowDirection: 'in' | 'out'
}

interface FloatingIntegration {
  name: string
  logo?: string
  icon?: LucideIcon
  delay: number
}

const STEPS: Step[] = [
  {
    id: 'connect',
    step: 1,
    title: 'Connect your channels',
    description:
      'Slack, email, widget, Intercom — every customer touchpoint in one place.',
    icon: MessageSquare,
    flowDirection: 'in',
    integrations: [
      { name: 'Slack', logo: '/logos/slack.svg', delay: 0 },
      { name: 'Intercom', logo: '/logos/intercom.svg', delay: 0.1 },
      { name: 'Gong', logo: '/logos/gong.svg', delay: 0.2 },
      { name: 'Gmail', logo: '/logos/gmail.svg', delay: 0.3 },
    ],
  },
  {
    id: 'ai-acts',
    step: 2,
    title: 'AI understands and acts',
    description:
      'Grounded in your codebase, AI answers questions, triages issues, and writes code.',
    icon: GitBranch,
    flowDirection: 'in',
    integrations: [
      { name: 'GitHub', logo: '/logos/github.svg', delay: 0 },
      { name: 'OpenAI', logo: '/logos/openai.svg', delay: 0.1 },
      { name: 'Anthropic', logo: '/logos/anthropic.svg', delay: 0.2 },
      { name: 'Knowledge', icon: BookOpen, delay: 0.3 },
    ],
  },
  {
    id: 'control',
    step: 3,
    title: 'You stay in control',
    description:
      'Review, approve, and ship. Nothing happens without your sign-off.',
    icon: FileCode,
    flowDirection: 'out',
    integrations: [
      { name: 'Linear', logo: '/logos/linear.svg', delay: 0 },
      { name: 'Jira', logo: '/logos/jira.svg', delay: 0.1 },
    ],
  },
]

function FloatingIntegrationLogo({
  integration,
  index,
}: {
  integration: FloatingIntegration
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: 0.3 + integration.delay,
        ease: 'easeOut',
      }}
      className="flex flex-col items-center"
    >
      {/* Floating logo with bobbing animation */}
      <motion.div
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: index * 0.3,
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--surface)]/80 shadow-sm backdrop-blur-sm"
        title={integration.name}
      >
        {integration.logo ? (
          <Image
            src={integration.logo}
            alt={integration.name}
            width={20}
            height={20}
            className={integration.name === 'Gmail' ? 'h-5 w-5' : 'h-5 w-5 dark:invert'}
          />
        ) : integration.icon ? (
          <integration.icon className="h-5 w-5 text-[var(--accent-teal)]" />
        ) : null}
      </motion.div>
    </motion.div>
  )
}

function AnimatedArrow({ direction }: { direction: 'down' | 'up' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative h-6 w-full flex justify-center"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className={direction === 'up' ? 'rotate-180' : ''}
      >
        {/* Animated dashed line */}
        <motion.path
          d="M12 4 L12 16"
          stroke="var(--accent-teal)"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
        />
        {/* Arrow head */}
        <motion.path
          d="M8 12 L12 16 L16 12"
          stroke="var(--accent-teal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 1 }}
        />
      </svg>
    </motion.div>
  )
}

function FloatingIntegrationsRow({
  integrations,
  flowDirection,
}: {
  integrations: FloatingIntegration[]
  flowDirection: 'in' | 'out'
}) {
  // For 'in' flow: icons above, arrow pointing down (into card)
  // For 'out' flow: icons above, arrow pointing up (from card to icons)
  const arrowDirection = flowDirection === 'in' ? 'down' : 'up'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-4">
        {integrations.map((integration, idx) => (
          <FloatingIntegrationLogo
            key={integration.name}
            integration={integration}
            index={idx}
          />
        ))}
      </div>
      <AnimatedArrow direction={arrowDirection} />
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            How It Works
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            From conversation to shipped code in three steps
          </p>
        </WaterReveal>

        {/* 3-step horizontal flow */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <WaterReveal
              key={step.id}
              preset="card"
              staggerIndex={index}
              stagger="normal"
            >
              <div className="relative h-full flex flex-col">
                {/* Connecting line (hidden on mobile, shown between cards on desktop) */}
                {index < STEPS.length - 1 && (
                  <div
                    className="absolute right-0 top-1/2 hidden h-[2px] w-8 translate-x-full bg-gradient-to-r from-[var(--accent-teal)] to-transparent md:block"
                    aria-hidden="true"
                  />
                )}

                {/* Floating integrations above card (all steps) */}
                <div className="mb-4 min-h-[72px] flex items-end justify-center">
                  <FloatingIntegrationsRow
                    integrations={step.integrations}
                    flowDirection={step.flowDirection}
                  />
                </div>

                <FloatingCard
                  floating="gentle"
                  variant="elevated"
                  respondToRipple
                  className="flex-1 p-6"
                  style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
                >
                  {/* Icon */}
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
                  >
                    <step.icon className="h-6 w-6 text-[var(--accent-teal)]" />
                  </div>

                  <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[var(--text-secondary)]">{step.description}</p>
                </FloatingCard>
              </div>
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
