'use client'

interface ResourceItemProps {
  name: string
  subtitle?: string
  isSelected: boolean
  onClick: () => void
}

export function ResourceItem({ name, subtitle, isSelected, onClick }: ResourceItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={`flex w-full flex-col gap-0 rounded-[4px] px-2 py-0.5 text-left transition cursor-pointer ${
        isSelected
          ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]'
      }`}
    >
      <span className="truncate text-[11px] leading-tight">{name}</span>
      {subtitle && (
        <span className={`truncate text-[9px] leading-tight ${
          isSelected ? 'text-[color:var(--background)]/70' : 'text-[color:var(--text-tertiary)]'
        }`}>
          {subtitle}
        </span>
      )}
    </button>
  )
}
