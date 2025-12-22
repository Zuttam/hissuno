import { ReactNode } from 'react'
import { Button } from './button'

type ToggleOption<T extends string> = {
  value: T
  label: ReactNode
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
  optionClassName,
}: ToggleGroupProps<T>) {
  const containerClasses = className ? `flex gap-3 ${className}` : 'flex gap-3'

  return (
    <div className={containerClasses}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="md"
            disabled={option.disabled}
            selected={isSelected}
            onClick={() => {
              if (!option.disabled) {
                onChange(option.value)
              }
            }}
            className={optionClassName}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}

