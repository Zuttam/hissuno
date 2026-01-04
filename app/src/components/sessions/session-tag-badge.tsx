'use client'

import { Badge } from '@/components/ui/badge'
import { SESSION_TAG_INFO, type SessionTag } from '@/types/session'

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

interface SessionTagBadgeProps {
  tag: SessionTag
  onRemove?: () => void
  removable?: boolean
  size?: 'sm' | 'md'
}

/**
 * Badge component for displaying a session tag with appropriate styling.
 */
export function SessionTagBadge({
  tag,
  onRemove,
  removable = false,
  size = 'sm',
}: SessionTagBadgeProps) {
  const tagInfo = SESSION_TAG_INFO[tag]

  return (
    <Badge
      variant={tagInfo.variant}
      className={size === 'sm' ? 'text-[9px] px-1.5 py-0' : undefined}
    >
      {tagInfo.label}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 -mr-0.5 hover:opacity-70"
          aria-label={`Remove ${tagInfo.label} tag`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </Badge>
  )
}

/**
 * Display multiple tags in a row.
 */
export function SessionTagList({
  tags,
  onRemove,
  removable = false,
  size = 'sm',
  emptyText = 'No tags',
}: {
  tags: SessionTag[]
  onRemove?: (tag: SessionTag) => void
  removable?: boolean
  size?: 'sm' | 'md'
  emptyText?: string
}) {
  if (tags.length === 0) {
    return (
      <span className="text-xs text-[color:var(--text-tertiary)]">{emptyText}</span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <SessionTagBadge
          key={tag}
          tag={tag}
          removable={removable}
          onRemove={onRemove ? () => onRemove(tag) : undefined}
          size={size}
        />
      ))}
    </div>
  )
}
