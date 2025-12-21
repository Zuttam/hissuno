import type { ProjectWithCodebase } from '@/lib/projects/queries'

export interface ProjectDetailsCardProps {
  project: ProjectWithCodebase
  isLoading?: boolean
  onRefresh?: () => Promise<void>
}
