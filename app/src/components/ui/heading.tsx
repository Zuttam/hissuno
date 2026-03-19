import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/class'

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

// Visual size variants (independent from semantic level)
type HeadingSize = 'page' | 'section' | 'subsection' | 'label'

const sizeClasses: Record<HeadingSize, string> = {
  page: 'font-mono text-3xl font-bold uppercase tracking-tight',
  section: 'font-mono text-lg font-bold uppercase',
  subsection: 'font-mono text-base font-semibold uppercase',
  label: 'font-mono text-sm font-medium uppercase tracking-wide',
}

interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  as?: HeadingLevel // Semantic HTML element (default: h2)
  size?: HeadingSize // Visual size (default: section)
}

const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ as: Tag = 'h2', size = 'section', className, ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={cn(sizeClasses[size], 'text-[color:var(--foreground)]', className)}
        {...props}
      />
    )
  }
)
Heading.displayName = 'Heading'

export { Heading, type HeadingProps, type HeadingSize, type HeadingLevel }
