import { notFound } from 'next/navigation'
import { ProjectAnalysisEditor } from '@/components/analysis/project-analysis-editor'
import { getProjectById } from '@/lib/supabase/projects'

interface AnalysisEditPageProps {
  params: { id: string }
}

export default async function AnalysisEditPage({ params }: AnalysisEditPageProps) {
  const project = await getProjectById(params.id)

  if (!project) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ProjectAnalysisEditor projectId={params.id} initialProject={project} />
    </main>
  )
}

