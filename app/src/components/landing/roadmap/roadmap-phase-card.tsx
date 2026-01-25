'use client'

import { FloatingCard } from '@/components/ui/floating-card'
import { WaterReveal } from '@/components/landing/water-reveal'
import { RoadmapItem } from './roadmap-item'
import type { RoadmapPhase as RoadmapPhaseType } from '@/app/(marketing)/roadmap/roadmap-data'
import { STATUS_CONFIG } from '@/app/(marketing)/roadmap/roadmap-data'

interface RoadmapPhaseCardProps {
  phase: RoadmapPhaseType
  index: number
}

export function RoadmapPhaseCard({ phase, index }: RoadmapPhaseCardProps) {
  const config = STATUS_CONFIG[phase.status]

  return (
    <WaterReveal preset="card" staggerIndex={index} stagger="organic">
      <FloatingCard
        floating="gentle"
        variant="elevated"
        respondToRipple
        className="p-6"
        style={{ '--float-delay': `${index * 0.2}s` } as React.CSSProperties}
      >
        {/* Phase header */}
        <div className="mb-6 flex items-center gap-3">
          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
              color: config.color,
            }}
          >
            {config.icon === 'pulse' && (
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: config.color }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
              </span>
            )}
            {config.label}
          </span>
        </div>

        {/* Phase title */}
        <h3 className="font-mono text-xl font-semibold text-[var(--foreground)]">
          {phase.title}
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{phase.subtitle}</p>

        {/* Items list */}
        <div className="mt-6 space-y-4">
          {phase.items.map((item, itemIndex) => (
            <RoadmapItem
              key={item.id}
              item={item}
              status={phase.status}
              index={itemIndex}
            />
          ))}
        </div>
      </FloatingCard>
    </WaterReveal>
  )
}
