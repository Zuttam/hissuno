'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { useProject } from '@/components/providers/project-provider'

export default function NewProjectPage() {
  const router = useRouter()
  const { setProjectId } = useProject()

  const handleClose = useCallback(() => {
    router.replace('/projects')
  }, [router])

  const handleProjectCreated = useCallback(
    (project: { id: string; name: string }) => {
      setProjectId(project.id)
    },
    [setProjectId]
  )

  return (
    <div className="flex h-full items-center justify-center">
      <CreateProjectDialog
        open={true}
        onClose={handleClose}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
