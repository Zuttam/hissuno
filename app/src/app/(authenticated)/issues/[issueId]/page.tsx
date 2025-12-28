import { IssuesPageContent } from '@/components/issues/issues-page'
import { listIssues, getIssueById } from '@/lib/supabase/issues'
import { listProjects } from '@/lib/projects/queries'

interface IssueDetailPageParams {
  params: Promise<{ issueId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function IssueDetailPage({ params, searchParams }: IssueDetailPageParams) {
  const { issueId } = await params
  const searchParamsResolved = await searchParams
  const projectId = typeof searchParamsResolved.project === 'string' ? searchParamsResolved.project : undefined

  // Fetch the issue to get its project_id for filtering
  const issue = await getIssueById(issueId)

  const [issues, projects] = await Promise.all([
    listIssues({ projectId, limit: 50 }),
    listProjects(),
  ])

  // If issue not in the initial list, we still pass the issueId
  // The component will handle fetching the issue details via the sidebar
  return (
    <IssuesPageContent
      initialIssues={issues}
      projects={projects}
      initialProjectFilter={projectId ?? issue?.project_id}
      initialIssueId={issueId}
    />
  )
}
