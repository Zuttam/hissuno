import { ReactNode } from 'react'

type ToggleOption<T extends string> = {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

type ToggleGroupProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: ToggleOption<T>[]
  className?: string
  optionClassName?: string
}

export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: ToggleGroupProps<T>) {
  return (
    <div className={`flex gap-1 border-b border-[color:var(--border-subtle)] ${className ?? ''}`}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled) {
                onChange(option.value)
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              isSelected
                ? 'border-b-2 border-[color:var(--accent-primary)] text-[color:var(--foreground)] -mb-px'
                : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'
            } ${option.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
