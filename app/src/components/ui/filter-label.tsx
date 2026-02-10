export function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 font-mono text-[10px] uppercase text-[color:var(--text-tertiary)]">
      {children}
    </span>
  )
}
