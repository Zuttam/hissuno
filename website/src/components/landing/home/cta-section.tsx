'use client'

import { InstallCommand } from '@/components/landing/install-command'

export function CTASection() {
  return (
    <section className="relative px-6 py-12 md:px-12">
      {/* Gradient overlay for visual interest */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--accent-teal) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h2 className="font-mono text-3xl font-bold text-[var(--foreground)] md:text-4xl">
          Stop Rebuilding Product Context for Every Agent
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
          Open source product intelligence. One graph. Every agent.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <InstallCommand />
        </div>
      </div>
    </section>
  )
}
