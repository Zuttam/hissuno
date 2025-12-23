import { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/class'

type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps extends ComponentPropsWithoutRef<'span'> {
  size?: SpinnerSize
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-[--accent-primary] border-t-transparent',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

