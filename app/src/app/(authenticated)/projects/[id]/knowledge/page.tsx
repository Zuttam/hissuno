import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Knowledge is no longer a top-level resource; it's now scope-attached.
 * Redirect to the products / scopes overview.
 */
export default async function KnowledgePage({ params }: PageProps) {
  const { id } = await params
  redirect(`/projects/${id}/products`)
}
