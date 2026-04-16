'use client'

interface SidebarSearchInputProps {
  value: string
  onChange: (value: string) => void
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export function SidebarSearchInput({ value, onChange }: SidebarSearchInputProps) {
  return (
    <div className="relative px-2 py-1.5">
      <SearchIcon className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--text-tertiary)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search resources..."
        className="h-7 w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] pl-7 pr-6 text-xs text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border)] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
        >
          <ClearIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
