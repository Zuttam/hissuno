'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/class'

interface KeyFieldProps {
  label: string
  value: string
  description?: string
  descriptionVariant?: 'default' | 'warning' | 'success'
  isSecret?: boolean
  disabled?: boolean
  className?: string
  compact?: boolean
}

export function KeyField({
  label,
  value,
  description,
  descriptionVariant = 'default',
  isSecret = false,
  disabled = false,
  className,
  compact = false,
}: KeyFieldProps) {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayValue = disabled
    ? 'Not generated yet'
    : isSecret && !showSecret
      ? maskValue(value)
      : value

  const copyToClipboard = async () => {
    if (disabled) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const descriptionColorClass = {
    default: 'text-[color:var(--text-tertiary)]',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
  }[descriptionVariant]

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 min-w-0 max-w-full', className)}>
        <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)] flex-shrink-0">
          {label}:
        </span>
        <code className="font-mono text-xs text-[color:var(--foreground)] truncate min-w-0">
          {displayValue}
        </code>
        <div className="flex gap-1 flex-shrink-0">
          {isSecret && !disabled && (
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="rounded p-1 text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] transition"
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? (
                <EyeOffIcon className="h-3.5 w-3.5" />
              ) : (
                <EyeIcon className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={disabled}
            className="rounded p-1 text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-50"
            title="Copy"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          {label}
        </span>
        {description && (
          <span className={cn('text-xs', descriptionColorClass)}>
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2">
          <code className="font-mono text-sm text-[color:var(--foreground)] break-all">
            {displayValue}
          </code>
        </div>
        <div className="flex gap-1">
          {isSecret && !disabled && (
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-[color:var(--text-secondary)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] transition"
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={disabled}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-[color:var(--text-secondary)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] transition disabled:cursor-not-allowed disabled:opacity-50"
            title="Copy"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-emerald-500" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function maskValue(value: string): string {
  if (!value || value === 'Not generated') return value
  if (value.length <= 12) return '•'.repeat(value.length)
  return value.slice(0, 8) + '•'.repeat(Math.min(value.length - 12, 20)) + value.slice(-4)
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
        clipRule="evenodd"
      />
      <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}
