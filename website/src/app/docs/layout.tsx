import { DocsSidebar, DocsMobileNav, DocsSearchDialog } from '@/components/docs'
import { generateSearchIndex } from './_lib/search-index'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const searchIndex = generateSearchIndex()

  return (
    <div className="mx-auto max-w-7xl">
      <DocsSearchDialog searchIndex={searchIndex} />
      <DocsMobileNav />
      <div className="flex px-4 py-8 md:px-6 lg:px-8">
        <DocsSidebar className="hidden lg:block" />
        <div className="min-w-0 flex-1 lg:pl-8">{children}</div>
      </div>
    </div>
  )
}
