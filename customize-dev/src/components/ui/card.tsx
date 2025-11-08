import { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLElement>

export function Card({ className, ...props }: CardProps) {
  const baseClasses =
    'rounded-[4px] border-2 border-[--border-subtle] bg-[--background] p-6'

  return (
    <section
      {...props}
      className={className ? `${baseClasses} ${className}` : baseClasses}
    />
  )
}

