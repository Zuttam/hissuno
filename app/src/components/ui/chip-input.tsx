'use client'

import { useState, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/class'

interface ChipInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  validateFn?: (value: string) => true | string
  disabled?: boolean
  className?: string
}

export function ChipInput({
  values,
  onChange,
  placeholder = 'Add item...',
  validateFn,
  disabled = false,
  className,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addValue = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    // Check for duplicates
    if (values.includes(trimmed)) {
      setError('Already added')
      return
    }

    // Run validation if provided
    if (validateFn) {
      const result = validateFn(trimmed)
      if (result !== true) {
        setError(result)
        return
      }
    }

    onChange([...values, trimmed])
    setInputValue('')
    setError(null)
  }

  const removeValue = (index: number) => {
    if (disabled) return
    const newValues = values.filter((_, i) => i !== index)
    onChange(newValues)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addValue()
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Chips display */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-3 py-1.5 text-sm font-mono text-[color:var(--foreground)] border border-[color:var(--border-subtle)]"
            >
              {value}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeValue(index)}
                  className="ml-1 rounded-full p-0.5 text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] transition"
                  aria-label={`Remove ${value}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input field */}
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border)] focus:outline-none"
          />
          <button
            type="button"
            onClick={addValue}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
          >
            Add
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-[color:var(--accent-danger)]">{error}</p>
      )}
    </div>
  )
}
