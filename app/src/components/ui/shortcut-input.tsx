'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/class'
import { Button } from '@/components/ui/button'

export interface ShortcutInputProps {
  value: string | null
  onChange: (shortcut: string | null) => void
  placeholder?: string
  className?: string
}

function formatKeyForDisplay(key: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')

  return key
    .split('+')
    .map((part) => {
      switch (part.toLowerCase()) {
        case 'mod':
          return isMac ? '⌘' : 'Ctrl'
        case 'ctrl':
          return isMac ? '⌃' : 'Ctrl'
        case 'alt':
          return isMac ? '⌥' : 'Alt'
        case 'shift':
          return isMac ? '⇧' : 'Shift'
        case 'meta':
          return isMac ? '⌘' : 'Win'
        default:
          return part.toUpperCase()
      }
    })
    .join(' + ')
}

function ShortcutInput({ value, onChange, placeholder = 'None (disabled)', className }: ShortcutInputProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedKeys, setCapturedKeys] = useState<string | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isCapturing) return

    e.preventDefault()
    e.stopPropagation()

    // Ignore standalone modifier keys
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return
    }

    // Build the shortcut string
    const parts: string[] = []

    // Use 'mod' for Cmd/Ctrl to be platform-agnostic
    if (e.metaKey || e.ctrlKey) {
      parts.push('mod')
    }
    if (e.altKey) {
      parts.push('alt')
    }
    if (e.shiftKey) {
      parts.push('shift')
    }

    // Get the key, normalizing special keys
    let key = e.key.toLowerCase()
    if (key === ' ') key = 'space'
    if (key === 'escape') {
      // Cancel on Escape
      setIsCapturing(false)
      setCapturedKeys(null)
      return
    }

    parts.push(key)

    const shortcut = parts.join('+')
    setCapturedKeys(shortcut)
  }, [isCapturing])

  useEffect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isCapturing, handleKeyDown])

  // Focus the capture area when entering capture mode
  useEffect(() => {
    if (isCapturing && captureRef.current) {
      captureRef.current.focus()
    }
  }, [isCapturing])

  const handleStartCapture = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCapturedKeys(null)
    setIsCapturing(true)
  }

  const handleConfirm = () => {
    onChange(capturedKeys)
    setIsCapturing(false)
    setCapturedKeys(null)
  }

  const handleCancel = () => {
    setIsCapturing(false)
    setCapturedKeys(null)
  }

  if (isCapturing) {
    return (
      <div className={cn('flex gap-2', className)}>
        <div
          ref={captureRef}
          tabIndex={0}
          className="relative flex-1 rounded-[4px] border-2 border-[--accent-primary] bg-[--background] px-3 py-2 text-sm font-mono text-[--foreground] outline-none text-center"
        >
          {capturedKeys ? (
            <>
              <span className="font-semibold">{formatKeyForDisplay(capturedKeys)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCapturedKeys(null)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[--surface-hover] text-[--text-secondary] hover:text-[--foreground] transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </>
          ) : (
            <span className="text-[--text-secondary]">Press a key combination...</span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleCancel()
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleConfirm()
          }}
        >
          Confirm
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleStartCapture}
      className={cn(
        'w-full text-left rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 text-sm font-mono cursor-pointer hover:border-[--border-hover] transition',
        value ? 'text-[--foreground]' : 'text-[--text-secondary]',
        className
      )}
    >
      {value ? formatKeyForDisplay(value) : placeholder}
    </button>
  )
}

ShortcutInput.displayName = 'ShortcutInput'

export { ShortcutInput }
