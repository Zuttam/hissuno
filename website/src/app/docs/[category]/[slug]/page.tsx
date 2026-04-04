import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DocsContent, DocsToc, DocsPageNav } from '@/components/docs'
import { getDocContent, getAllDocSlugs } from '../../_lib/markdown'
import { extractToc } from '../../_lib/toc'
import { getCategoryTitle, getAdjacentPages } from '../../_config/docs-nav'

interface PageProps {
  params: Promise<{ category: string; slug: string }>
}

export async function generateStaticParams() {
  return getAllDocSlugs()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, slug } = await params
  const doc = getDocContent(category, slug)

  if (!doc) {
    return { title: 'Not Found - Hissuno Docs' }
  }

  return {
    title: `${doc.meta.title} - Hissuno Docs`,
    description: doc.meta.description,
  }
}

export default async function DocPage({ params }: PageProps) {
  const { category, slug } = await params
  const doc = getDocContent(category, slug)

  if (!doc) {
    notFound()
  }

  const categoryTitle = getCategoryTitle(category)
  const toc = extractToc(doc.content)
  const { prev, next } = getAdjacentPages(category, slug)

  return (
    <div className="flex gap-8">
      <article className="min-w-0 flex-1">
        <div className="mb-6">
          {categoryTitle && (
            <Link
              href="/docs"
              className="text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)] hover:text-[color:var(--accent-teal)] transition"
            >
              {categoryTitle}
            </Link>
          )}
          <h1 className="mt-2 font-mono text-3xl font-bold text-[color:var(--foreground)]">
            {doc.meta.title}
          </h1>
          {doc.meta.description && (
            <p className="mt-2 text-[color:var(--text-secondary)]">{doc.meta.description}</p>
          )}
        </div>

        <DocsContent content={doc.content} />
        <DocsPageNav prev={prev} next={next} />
      </article>

      <DocsToc items={toc} />
    </div>
  )
}
