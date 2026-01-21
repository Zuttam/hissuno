import { redirect } from 'next/navigation'
import { listProjects } from '@/lib/supabase/projects'

interface IssuesPageParams {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function IssuesPage({ searchParams }: IssuesPageParams) {
  const params = await searchParams
  const projectId = typeof params.project === 'string' ? params.project : undefined

  // If project is specified in query params, redirect to that project's issues
  if (projectId) {
    redirect(`/projects/${projectId}/issues`)
  }

  // Otherwise, get the first project and redirect there
  const projects = await listProjects()

  if (projects.length > 0) {
    // Redirect to the first project's issues page
    redirect(`/projects/${projects[0].id}/issues`)
  }

  // If no projects, redirect to projects page to create one
  redirect('/projects')
}
