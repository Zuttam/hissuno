
interface AppHeaderProps {
  title: string
  description?: string  
  actions?: React.ReactNode
}

export function AppHeader({
  title,
  description,  
  actions,
}: AppHeaderProps) {
  return (
    <header className="flex-shrink-0 h-16 flex items-center justify-between gap-4 pr-4 pl-16 md:px-6 border-b border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/80 relative z-10">
      {/* Left side: Project name / Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          {title}
        </span>
        <span className="text-[color:var(--text-tertiary)]">/</span>
        {description && (
          <>
            <span className="hidden md:inline text-[color:var(--text-tertiary)]">—</span>
            <span className="hidden md:inline text-sm text-[color:var(--text-tertiary)] truncate max-w-md">
              {description}
            </span>
          </>
        )}
      </div>

      {/* Right side: Actions */}
      {(actions) && (
        <div className="flex flex-shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}