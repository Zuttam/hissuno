'use client'

import { useMemo } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { useUser } from '@/components/providers/auth-provider'
import { PageHeader, Spinner } from '@/components/ui'
import { MembersSection } from '@/components/access/members-section'
import { ApiKeysSection } from '@/components/access/api-keys-section'
import { useProjectMembers } from '@/hooks/use-project-members'
import { useProjectApiKeys } from '@/hooks/use-project-api-keys'

export default function AccessPage() {
  const { user } = useUser()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const { members, isLoading: isLoadingMembers, refresh: refreshMembers } = useProjectMembers(projectId ?? undefined)
  const { apiKeys, isLoading: isLoadingApiKeys, refresh: refreshApiKeys } = useProjectApiKeys(projectId ?? undefined)

  const isOwner = useMemo(() => {
    if (!user) return false
    return members.some((m) => m.user_id === user.id && m.role === 'owner' && m.status === 'active')
  }, [members, user])

  if (isLoadingProject || !project || !projectId) {
    return (
      <>
        <PageHeader title="Access" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Access" />

      <MembersSection
        projectId={projectId}
        members={members}
        isLoading={isLoadingMembers}
        onRefresh={refreshMembers}
        isOwner={isOwner}
      />

      <ApiKeysSection
        projectId={projectId}
        apiKeys={apiKeys}
        isLoading={isLoadingApiKeys}
        onRefresh={refreshApiKeys}
        isOwner={isOwner}
      />
    </>
  )
}
