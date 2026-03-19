import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getProjectById } from '@/lib/db/queries/projects'
import { ProjectSync } from '@/components/providers/project-sync'
import { ProjectPageLayout } from '@/components/layout/project-page-layout'



interface ProjectLayoutParams {
  id: string
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<ProjectLayoutParams>
}) {
  const { id } = await params

  // Skip layout for "new" project route
  if (id === 'new') {
    return <>{children}</>
  }

  // Verify project exists and user has access
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  return (
    <ProjectPageLayout>
      <ProjectSync projectId={id} />
      {children}
    </ProjectPageLayout>
  )
}
