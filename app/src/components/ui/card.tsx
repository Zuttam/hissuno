'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/class'

type CardProps = HTMLAttributes<HTMLElement> & {
}

export const cardBaseClasses =
  'rounded-[4px] border-2 border-(--border-subtle) bg-(--background) p-6 relative'

export function Card({
  className,
  ...props
}: CardProps) {
  return <section className={cn(cardBaseClasses, className)} {...props} />
}
