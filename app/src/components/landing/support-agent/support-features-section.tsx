'use client'

import Image from 'next/image'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const FEATURES = [
  {
    id: 'widget',
    title: 'Web Widget',
    description:
      'Embed in 2 minutes. No training required. Customers get instant, accurate answers 24/7.',
    icon: '/window.svg',
  },
  {
    id: 'slack',
    title: 'Slack Integration',
    description:
      'Works in your community and support channels. Responds in threads, keeps conversations organized.',
    icon: '/logos/slack.svg',
  },
  {
    id: 'email',
    title: 'Email Support',
    description:
      'Connect Gmail or Outlook. AI responds to support emails while you supervise and approve.',
    icon: '/logos/gmail.svg',
  },
]

export function SupportFeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Multi-Channel Support
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            Meet customers where they are — web, Slack, or email
          </p>
        </WaterReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <WaterReveal
              key={feature.id}
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
                  className="inline-flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' }}
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
            </WaterReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
