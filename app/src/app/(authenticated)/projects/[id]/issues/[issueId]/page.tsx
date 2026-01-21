import { redirect } from 'next/navigation'

interface IssuePageParams {
  id: string
  issueId: string
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<IssuePageParams>
}) {
  const { id, issueId } = await params

  // Redirect to issues page with issue selected
  // The issues page handles the sidebar display
  redirect(`/projects/${id}/issues?issue=${issueId}`)
}
