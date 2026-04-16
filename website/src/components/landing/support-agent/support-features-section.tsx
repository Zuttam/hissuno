'use client'

import Image from 'next/image'
import { FloatingCard } from '@/components/ui/floating-card'

const FEATURES = [
  {
    id: 'widget',
    title: 'Web Widget',
    description:
      'Instant self-service that reduces ticket volume by up to 40%. Customers get answers before they get frustrated.',
    icon: '/window.svg',
  },
  {
    id: 'slack',
    title: 'Slack Integration',
    description:
      'Faster response times in community channels. Turn support threads into retention moments, not escalation points.',
    icon: '/logos/slack.svg',
  },
  {
    id: 'email',
    title: 'Email Support',
    description:
      'Reduce average response time from hours to minutes. Every quick, accurate reply builds customer trust.',
    icon: '/logos/gmail.svg',
  },
]

export function SupportFeaturesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Every Channel, Instant Resolution
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Faster answers on every channel means higher CSAT and lower support costs
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FloatingCard
              key={feature.id}
              floating="gentle"
              variant="elevated"
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
          ))}
        </div>
      </div>
    </section>
  )
}
