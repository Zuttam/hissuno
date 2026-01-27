'use client'

import { motion } from 'motion/react'
import type { RoadmapItem as RoadmapItemType, RoadmapStatus } from '@/app/(marketing)/landing/roadmap/roadmap-data'
import { STATUS_CONFIG } from '@/app/(marketing)/landing/roadmap/roadmap-data'

interface RoadmapItemProps {
  item: RoadmapItemType
  status: RoadmapStatus
  index: number
}

export function RoadmapItem({ item, status, index }: RoadmapItemProps) {
  const config = STATUS_CONFIG[status]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex gap-3"
    >
      {/* Status indicator */}
      <div
        className="mt-1.5 flex h-4 w-4 flex-shrink-0 items-center justify-center"
        style={{ color: config.color }}
      >
        {config.icon === 'check' && (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {config.icon === 'pulse' && (
          <span className="relative flex h-3 w-3">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: config.color }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
          </span>
        )}
        {config.icon === 'clock' && (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
          </svg>
        )}
        {config.icon === 'circle' && (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="font-medium text-[var(--foreground)]">{item.title}</h4>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{item.description}</p>
      </div>
    </motion.div>
  )
}
