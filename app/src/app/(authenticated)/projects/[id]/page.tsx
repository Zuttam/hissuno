import { redirect } from 'next/navigation'

interface ProjectPageParams {
  id: string
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<ProjectPageParams>
}) {
  const { id } = await params

  // Redirect to dashboard page
  redirect(`/projects/${id}/dashboard`)
}
