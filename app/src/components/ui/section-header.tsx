import { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type SectionHeaderProps = {
  title: ReactNode
  description?: ReactNode
  titleAs?: ElementType
  className?: string
  titleClassName?: string
  descriptionClassName?: string
} & Omit<ComponentPropsWithoutRef<'header'>, 'title'>

export function SectionHeader({
  title,
  description,
  titleAs: TitleTag = 'h2',
  className,
  titleClassName,
  descriptionClassName,
  ...props
}: SectionHeaderProps) {
  const containerClasses = className ? `space-y-2 ${className}` : 'space-y-2'
  const titleClasses =
    titleClassName ??
    'text-xl font-mono font-bold uppercase tracking-tight text-[--foreground]'
  const descriptionClasses =
    descriptionClassName ?? 'text-sm text-[--text-secondary]'

  return (
    <header {...props} className={containerClasses}>
      <TitleTag className={titleClasses}>{title}</TitleTag>
      {description ? <p className={descriptionClasses}>{description}</p> : null}
    </header>
  )
}

