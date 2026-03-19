import { redirect } from 'next/navigation'
import { getIssueById } from '@/lib/db/queries/issues'
import { listProjects } from '@/lib/db/queries/projects'
import { getSessionById } from '@/lib/db/queries/sessions'

interface SessionDetailPageParams {
  params: Promise<{ sessionId: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageParams) {
  const { sessionId } = await params

  // Get session to determine its project
  const session = await getSessionById(sessionId) 
  if (session?.project_id) {
    // Redirect to the new project-scoped session page
    redirect(`/projects/${session.project_id}/sessions?session=${sessionId}`)
  }

  // If session not found or no project, redirect to projects list
  const projects = await listProjects()

  if (projects.length > 0) {
    redirect(`/projects/${projects[0].id}/sessions`)
  }

  redirect('/projects')
}
