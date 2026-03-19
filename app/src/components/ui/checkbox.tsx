'use client'

import { forwardRef, type ReactNode, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onChange, label, description, disabled, id, ...props }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`

    const indicator = (
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          checked
            ? 'border-[--accent-selected] bg-[--accent-selected]'
            : 'border-[--border-subtle]'
        )}
      >
        {checked && (
          <svg
            className="h-3 w-3 text-black dark:text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
    )

    if (!label) {
      return (
        <label className={cn('relative cursor-pointer', disabled && 'cursor-not-allowed opacity-50', className)}>
          <input
            type="checkbox"
            id={inputId}
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={disabled}
            ref={ref}
            className="sr-only"
            {...props}
          />
          {indicator}
        </label>
      )
    }

    return (
      <label
        htmlFor={inputId}
        className={cn(
          'flex items-start gap-3 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <input
          type="checkbox"
          id={inputId}
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          ref={ref}
          className="sr-only"
          {...props}
        />
        {indicator}
        <div>
          <span className="font-medium text-[--foreground]">{label}</span>
          {description && (
            <p className="text-sm text-[--text-secondary]">{description}</p>
          )}
        </div>
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
