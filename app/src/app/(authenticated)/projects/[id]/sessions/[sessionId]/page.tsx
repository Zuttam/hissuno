import { redirect } from 'next/navigation'

interface SessionPageParams {
  id: string
  sessionId: string
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<SessionPageParams>
}) {
  const { id, sessionId } = await params

  // Redirect to sessions page with session selected
  // The sessions page handles the sidebar display
  redirect(`/projects/${id}/sessions?session=${sessionId}`)
}
