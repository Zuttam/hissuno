'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  step?: number
  showValue?: boolean
  valueFormatter?: (value: number) => string
  minLabel?: string
  maxLabel?: string
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      min,
      max,
      value,
      onChange,
      step = 1,
      showValue = true,
      valueFormatter,
      minLabel,
      maxLabel,
      disabled,
      ...props
    },
    ref
  ) => {
    const displayValue = valueFormatter ? valueFormatter(value) : String(value)
    const hasLabels = minLabel || maxLabel || showValue
    const percentage = ((value - min) / (max - min)) * 100

    return (
      <div className={cn('space-y-2', className)}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          ref={ref}
          style={{
            background: `linear-gradient(to right, var(--foreground) 0%, var(--foreground) ${percentage}%, var(--border-subtle) ${percentage}%, var(--border-subtle) 100%)`,
          }}
          className={cn(
            'w-full h-2 rounded-full appearance-none cursor-pointer',
            '[&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--foreground)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition [&::-webkit-slider-thumb]:shadow-md',
            '[&::-moz-range-track]:rounded-full',
            '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[color:var(--foreground)] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-primary] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          {...props}
        />
        {hasLabels && (
          <div className="flex justify-between text-xs text-[--text-tertiary]">
            {minLabel && <span>{minLabel}</span>}
            {showValue && (
              <span className="font-medium text-[--foreground]">{displayValue}</span>
            )}
            {maxLabel && <span>{maxLabel}</span>}
          </div>
        )}
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
