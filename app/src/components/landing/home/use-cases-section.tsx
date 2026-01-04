'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FloatingCard } from '@/components/ui/floating-card'

const USE_CASES = [
  {
    id: 'knowledge',
    title: 'Support Agent Knowledge',
    description: 'Build AI support agents powered by your codebase and documentation.',
    icon: '/github.svg',
    color: 'var(--accent-teal)',
    utmContent: 'knowledge',
  },
  {
    id: 'slack',
    title: 'Customer Success in Slack',
    description: 'Deploy AI customer success agents directly in Slack channels.',
    icon: '/slack.svg',
    color: 'var(--accent-warm)',
    utmContent: 'slack',
  },
  {
    id: 'triage',
    title: 'Automated Triage',
    description: 'Automatically classify and prioritize customer conversations.',
    icon: '/linear.svg',
    color: 'var(--accent-coral)',
    utmContent: 'triage',
  },
  {
    id: 'specs',
    title: 'Product Specs Automation',
    description: 'Generate product specs and code changes from customer requests.',
    icon: '/jira.svg',
    color: 'var(--accent-selected)',
    utmContent: 'specs',
  },
]

export function UseCasesSection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
          Choose Your Use Case
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
          Start with what matters most to your team
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {USE_CASES.map((useCase, index) => (
            <Link
              key={useCase.id}
              href={`/sign-up?utm_content=${useCase.utmContent}`}
              className="block"
            >
              <FloatingCard
                floating="gentle"
                variant="elevated"
                respondToRipple
                className="h-full cursor-pointer p-6 transition-colors hover:border-[var(--accent-teal)]"
                style={{ '--float-delay': `${index * 0.3}s` } as React.CSSProperties}
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${useCase.color} 15%, transparent)` }}
                >
                  <Image
                    src={useCase.icon}
                    alt=""
                    width={28}
                    height={28}
                    className="opacity-80"
                  />
                </div>
                <h3 className="mt-4 font-mono text-xl font-semibold text-[var(--foreground)]">
                  {useCase.title}
                </h3>
                <p className="mt-2 text-[var(--text-secondary)]">{useCase.description}</p>
              </FloatingCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
