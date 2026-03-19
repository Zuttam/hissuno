import type { Metadata } from 'next'
import Link from 'next/link'
import { DOCS_NAV } from './_config/docs-nav'

export const metadata: Metadata = {
  title: 'Documentation - Hissuno',
  description: 'Learn how to use Hissuno to turn customer feedback into actionable engineering work.',
}

export default function DocsPage() {
  return (
    <div>
      <header className="mb-10">
        <h1 className="font-mono text-3xl font-bold text-[color:var(--foreground)]">Documentation</h1>
        <p className="mt-3 text-[color:var(--text-secondary)]">
          Everything you need to set up and use Hissuno.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCS_NAV.map((category) => (
          <Link
            key={category.slug}
            href={category.items[0].href}
            className="group rounded-[4px] border border-[color:var(--border-subtle)] p-5 transition hover:border-[color:var(--accent-teal)]"
          >
            <h2 className="font-mono text-sm font-semibold text-[color:var(--foreground)] group-hover:text-[color:var(--accent-teal)] transition">
              {category.title}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{category.description}</p>
            <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
              {category.items.length + (category.subsections?.reduce((acc, sub) => acc + sub.items.length, 0) ?? 0)}{' '}
              articles
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
