import { redirect } from 'next/navigation'
import { listProjects } from '@/lib/db/queries/projects'
import { getSessionUser } from '@/lib/auth/server'

interface SessionsPageParams {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SessionsRoute({ searchParams }: SessionsPageParams) {
  const params = await searchParams
  const projectId = typeof params.project === 'string' ? params.project : undefined

  // If project is specified in query params, redirect to that project's sessions
  if (projectId) {
    redirect(`/projects/${projectId}/sessions`)
  }

  // Otherwise, get the first project and redirect there
  const user = await getSessionUser()
  const projects = await listProjects(user!.id)

  if (projects.length > 0) {
    // Redirect to the first project's sessions page
    redirect(`/projects/${projects[0].id}/sessions`)
  }

  // If no projects, redirect to projects page to create one
  redirect('/projects')
}
