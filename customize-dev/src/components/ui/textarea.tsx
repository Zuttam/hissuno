import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full rounded-[4px] border-2 border-[--border-subtle] bg-[--background] px-3 py-2 text-sm font-mono text-[--foreground] outline-none transition focus:border-[--accent-primary] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }

