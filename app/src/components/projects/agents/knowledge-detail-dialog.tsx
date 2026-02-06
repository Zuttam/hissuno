'use client'

import { Dialog, Button } from '@/components/ui'
import { PackageList } from '@/components/projects/knowledge/package-list'

interface KnowledgeDetailDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  activePackageId: string | null
  onPackagesChange: () => void
  hasResources: boolean
}

export function KnowledgeDetailDialog({
  open,
  onClose,
  projectId,
  activePackageId,
  onPackagesChange,
  hasResources,
}: KnowledgeDetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Knowledge Management" size="2xl">
      <div className="flex flex-col gap-4">
        <PackageList
          projectId={projectId}
          activePackageId={activePackageId}
          initialExpandedPackageId={activePackageId}
          onPackagesChange={onPackagesChange}
          hasResources={hasResources}
        />
      </div>
    </Dialog>
  )
}
