import Link from 'next/link'

interface PageLink {
  title: string
  href: string
  category: string
}

interface DocsPageNavProps {
  prev: PageLink | null
  next: PageLink | null
}

export function DocsPageNav({ prev, next }: DocsPageNavProps) {
  if (!prev && !next) return null

  return (
    <nav className="mt-12 flex items-stretch gap-4 border-t border-[color:var(--border-subtle)] pt-6" aria-label="Page navigation">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-1 flex-col rounded-[4px] border border-[color:var(--border-subtle)] p-4 transition hover:border-[color:var(--accent-teal)]"
        >
          <span className="text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Previous
          </span>
          <span className="mt-1 text-sm font-medium text-[color:var(--foreground)] group-hover:text-[color:var(--accent-teal)] transition">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-1 flex-col items-end rounded-[4px] border border-[color:var(--border-subtle)] p-4 transition hover:border-[color:var(--accent-teal)]"
        >
          <span className="text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Next
          </span>
          <span className="mt-1 text-sm font-medium text-[color:var(--foreground)] group-hover:text-[color:var(--accent-teal)] transition">
            {next.title}
          </span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  )
}
