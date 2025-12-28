import { SessionsPage } from '@/components/sessions/sessions-page'
import { listSessions } from '@/lib/supabase/sessions'
import { listProjects } from '@/lib/projects/queries'

interface SessionsPageParams {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SessionsRoute({ searchParams }: SessionsPageParams) {
  const params = await searchParams
  const projectId = typeof params.project === 'string' ? params.project : undefined
  const sessionId = typeof params.session === 'string' ? params.session : undefined

  const [sessions, projects] = await Promise.all([
    listSessions({ projectId, limit: 50 }),
    listProjects(),
  ])

  return (
    <SessionsPage
      initialSessions={sessions}
      projects={projects}
      initialProjectFilter={projectId}
      initialSessionId={sessionId}
    />
  )
}
