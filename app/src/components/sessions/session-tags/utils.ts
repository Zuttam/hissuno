export interface TagOption {
  slug: string
  label: string
  variant: 'info' | 'success' | 'danger' | 'warning' | 'default'
}

export function getVariantColor(variant: TagOption['variant']): string {
  switch (variant) {
    case 'success':
      return 'bg-[color:var(--accent-success)]'
    case 'danger':
      return 'bg-[color:var(--accent-danger)]'
    case 'warning':
      return 'bg-[color:var(--accent-warning)]'
    case 'default':
      return 'bg-[color:var(--text-tertiary)]'
    default:
      return 'bg-[color:var(--accent-primary)]'
  }
}
