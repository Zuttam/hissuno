'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/class'

interface TrimmedTextProps {
  text: string | null | undefined
  maxLength?: number
  className?: string
}

export function TrimmedText({ text, maxLength = 120, className }: TrimmedTextProps) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const needsTrim = text.length > maxLength
  const displayText = expanded || !needsTrim ? text : text.slice(0, maxLength).trimEnd() + '...'

  return (
    <p className={cn('text-sm text-[color:var(--text-secondary)]', className)}>
      {displayText}
      {needsTrim && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-1 text-[color:var(--accent-selected)] hover:underline"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </p>
  )
}
