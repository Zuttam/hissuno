import { notFound } from 'next/navigation'
import { ProjectDetail } from '@/components/projects/project-detail'
import { getProjectById } from '@/lib/projects/queries'

interface ProjectPageParams {
  id: string
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<ProjectPageParams>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  return <ProjectDetail projectId={id} initialProject={project} />
}
