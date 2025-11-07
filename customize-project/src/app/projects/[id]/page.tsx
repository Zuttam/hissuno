import { notFound } from 'next/navigation'
import { ProjectDetail } from '@/components/projects/project-detail'
import { getProjectById } from '@/lib/supabase/projects'

interface ProjectPageProps {
  params: { id: string }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await getProjectById(params.id)

  if (!project) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ProjectDetail projectId={params.id} initialProject={project} />
    </main>
  )
}

