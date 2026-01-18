import { ComponentPropsWithoutRef, ReactNode } from 'react'

type FormFieldElement = 'label' | 'div'

type FormFieldProps = {
  as?: FormFieldElement
  label: ReactNode
  description?: ReactNode
  supportingText?: ReactNode
  className?: string
  labelClassName?: string
  descriptionClassName?: string
  supportingTextClassName?: string
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'label'>, 'className'>

export function FormField({
  as = 'label',
  label,
  description,
  supportingText,
  className,
  labelClassName,
  descriptionClassName,
  supportingTextClassName,
  children,
  ...props
}: FormFieldProps) {
  const containerClasses = 'flex flex-col gap-2'
  const mergedClasses = className
    ? `${containerClasses} ${className}`
    : containerClasses

  if (as === 'label') {
    return (
      <label {...(props as ComponentPropsWithoutRef<'label'>)} className={mergedClasses}>
        <span
          className={
            labelClassName ??
            'block text-sm font-mono font-semibold uppercase tracking-wide text-(--foreground)'
          }
        >
          {label}
        </span>
        {description ? (
          <span
            className={
              descriptionClassName ??
              'text-xs font-normal text-(--text-secondary)'
            }
          >
            {description}
          </span>
        ) : null}
        <div>{children}</div>
        {supportingText ? (
          <span
            className={
              supportingTextClassName ??
              'text-xs font-normal text-(--text-secondary)'
            }
          >
            {supportingText}
          </span>
        ) : null}
      </label>
    )
  }

  return (
    <div {...(props as ComponentPropsWithoutRef<'div'>)} className={mergedClasses}>
      <span
        className={
          labelClassName ??
          'block text-sm font-mono font-semibold uppercase tracking-wide text-[--foreground]'
        }
      >
        {label}
      </span>
      {description ? (
        <span
          className={
            descriptionClassName ??
            'text-xs font-normal text-(--text-secondary)'
          }
        >
          {description}
        </span>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">{children}</div>
      {supportingText ? (
        <span
          className={
            supportingTextClassName ??
            'text-xs font-normal text-(--text-secondary)'
          }
        >
          {supportingText}
        </span>
      ) : null}
    </div>
  )
}

