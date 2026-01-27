'use client'

import Image from 'next/image'
import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'

const FEATURES = [
  {
    id: 'widget',
    title: 'Website Widget',
    description:
      'Drop in a script tag. Customers get instant answers without waiting for you.',
    icon: '/window.svg',
  },
  {
    id: 'slack',
    title: 'Slack Channels',
    description:
      'Add Hissuno to your community or support channel. It responds in threads, keeps conversations organized.',
    icon: '/logos/slack.svg',
  },
  {
    id: 'issues',
    title: 'Every Conversation Becomes an Issue',
    description:
      'When customers report bugs or request features, Hissuno creates issues automatically. Nothing gets lost.',
    icon: '/logos/linear.svg',
  },
]

export function SupportFeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Works Everywhere Your Customers Are
          </h2>
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
