'use client'

import { useProject } from '@/components/providers/project-provider'
import { PageHeader, Spinner } from '@/components/ui'
import { MembersSection } from '@/components/access/members-section'
import { ApiKeysSection } from '@/components/access/api-keys-section'
import { useProjectMembers } from '@/hooks/use-project-members'
import { useProjectApiKeys } from '@/hooks/use-project-api-keys'

export default function AccessPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const { members, isLoading: isLoadingMembers, refresh: refreshMembers } = useProjectMembers(projectId ?? undefined)
  const { apiKeys, isLoading: isLoadingApiKeys, refresh: refreshApiKeys } = useProjectApiKeys(projectId ?? undefined)

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
      />

      <ApiKeysSection
        projectId={projectId}
        apiKeys={apiKeys}
        isLoading={isLoadingApiKeys}
        onRefresh={refreshApiKeys}
      />
    </>
  )
}
