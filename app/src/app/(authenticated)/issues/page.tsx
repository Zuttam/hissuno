import { IssuesPageContent } from '@/components/issues/issues-page'
import { listIssues } from '@/lib/supabase/issues'
import { listProjects } from '@/lib/projects/queries'

interface IssuesPageParams {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function IssuesPage({ searchParams }: IssuesPageParams) {
  const params = await searchParams
  const projectId = typeof params.project === 'string' ? params.project : undefined

  const [issues, projects] = await Promise.all([
    listIssues({ projectId, limit: 50 }),
    listProjects(),
  ])

  return (
    <IssuesPageContent
      initialIssues={issues}
      projects={projects}
      initialProjectFilter={projectId}
    />
  )
}
