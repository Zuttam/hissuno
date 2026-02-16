'use client'

import { useEffect, useCallback, ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils/class'

export type DialogSize = 'md' | 'lg' | 'xl' | 'xxl' 

const sizeClasses: Record<DialogSize, string> = {
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  xxl: 'max-w-5xl',
}

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  size?: DialogSize
}

export function Dialog({ open, onClose, title, children, className, size = 'md' }: DialogProps) {
  const [mounted, setMounted] = useState(false)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, handleEscape])

  if (!open || !mounted) return null

  const dialogContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className={cn(
            'w-full max-h-[90vh] flex flex-col rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl',
            sizeClasses[size],
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] p-4">
            <h2
              id="dialog-title"
              className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close dialog"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </>
  )

  // Use portal to render dialog at document.body level, escaping any parent stacking contexts
  return createPortal(dialogContent, document.body)
}
