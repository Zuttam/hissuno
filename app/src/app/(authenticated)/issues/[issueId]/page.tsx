import { redirect } from 'next/navigation'
import { getIssueById } from '@/lib/supabase/issues'
import { listProjects } from '@/lib/supabase/projects'

interface IssueDetailPageParams {
  params: Promise<{ issueId: string }>
}

export default async function IssueDetailPage({ params }: IssueDetailPageParams) {
  const { issueId } = await params

  // Get issue to determine its project
  const issue = await getIssueById(issueId)

  if (issue?.project_id) {
    // Redirect to the new project-scoped issue page
    redirect(`/projects/${issue.project_id}/issues?issue=${issueId}`)
  }

  // If issue not found or no project, redirect to projects list
  const projects = await listProjects()

  if (projects.length > 0) {
    redirect(`/projects/${projects[0].id}/issues`)
  }

  redirect('/projects')
}
