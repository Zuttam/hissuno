'use client'

import { Button } from '@/components/ui'
import { InstallCommand } from '@/components/landing/install-command'

export function FAQCTASection() {
  return (
    <section className="relative px-6 py-24 md:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--accent-teal) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h2 className="font-mono text-3xl font-bold text-[var(--foreground)] md:text-4xl">
          Ready to Connect Your Product Intelligence?
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
          Set up in minutes. One integration powers every agent.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <InstallCommand />
          <a
            href="https://github.com/zuttam/hissuno"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="secondary">
              View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </section>
  )
}
