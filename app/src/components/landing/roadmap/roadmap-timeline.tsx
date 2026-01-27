'use client'

import { WaterReveal } from '@/components/landing/water-reveal'
import { RoadmapPhaseCard } from './roadmap-phase-card'
import { ROADMAP_PHASES } from '@/app/(marketing)/landing/roadmap/roadmap-data'

export function RoadmapTimeline() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-6xl">
        <WaterReveal preset="text" parallax parallaxDepth={0.08}>
          <h2 className="text-center font-mono text-3xl font-bold text-[var(--foreground)]">
            Our Roadmap
          </h2>
        </WaterReveal>

        <WaterReveal preset="text" delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--text-secondary)]">
            See what we&apos;ve built and where we&apos;re heading next
          </p>
        </WaterReveal>

        {/* Timeline grid */}
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {ROADMAP_PHASES.map((phase, index) => (
            <RoadmapPhaseCard key={phase.status} phase={phase} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
