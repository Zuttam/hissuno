'use client'

import { Badge } from '@/components/ui/badge'
import { getTagInfo } from '@/types/session'

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
  /** Tag slug */
  tag: string
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
  const tagInfo = getTagInfo(tag)

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

interface SessionTagListProps {
  /** Array of tag slugs */
  tags: string[]
  onRemove?: (tag: string) => void
  removable?: boolean
  size?: 'sm' | 'md'
  emptyText?: string
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
}: SessionTagListProps) {
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
