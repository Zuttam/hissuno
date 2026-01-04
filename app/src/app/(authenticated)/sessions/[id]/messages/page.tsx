import { SessionsPage } from '@/components/sessions/sessions-page'
import { listSessions, getSessionById } from '@/lib/supabase/sessions'
import { listProjects } from '@/lib/projects/queries'

interface SessionMessagesPageParams {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SessionMessagesPage({ params, searchParams }: SessionMessagesPageParams) {
  const { id: sessionId } = await params
  const searchParamsResolved = await searchParams
  const projectId = typeof searchParamsResolved.project === 'string' ? searchParamsResolved.project : undefined

  const session = await getSessionById(sessionId)

  const [sessions, projects] = await Promise.all([
    listSessions({ projectId, limit: 50 }),
    listProjects(),
  ])

  return (
    <SessionsPage
      initialSessions={sessions}
      projects={projects}
      initialProjectFilter={projectId ?? session?.project_id}
      initialSessionId={sessionId}
      initialView="messages"
    />
  )
}
