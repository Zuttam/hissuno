import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

type DividerOrientation = 'horizontal' | 'vertical'

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation
}

const orientationClasses: Record<DividerOrientation, string> = {
  horizontal: 'w-full border-b',
  vertical: 'h-full border-r',
}

const Divider = forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={cn(
          'border-[color:var(--border-subtle)] my-4',
          orientationClasses[orientation],
          className
        )}
        {...props}
      />
    )
  }
)
Divider.displayName = 'Divider'

export { Divider }
