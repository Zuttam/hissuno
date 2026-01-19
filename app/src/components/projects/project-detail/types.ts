import type { ProjectRecord } from '@/lib/supabase/projects'

export interface ProjectDetailsCardProps {
  project: ProjectRecord
  isLoading?: boolean
  onRefresh?: () => Promise<void>
}
