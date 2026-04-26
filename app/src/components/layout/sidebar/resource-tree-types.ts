export type ResourceGroupType = 'issues' | 'feedback' | 'customers' | 'scopes'

export interface ResourceGroupItem {
  id: string
  name: string
  subtitle?: string
  type: ResourceGroupType
  subtype?: string
  parentId?: string
}

export interface ResourceGroupData {
  items: ResourceGroupItem[]
  total: number
  isLoading: boolean
  error: string | null
}

export const RESOURCE_GROUPS: { type: ResourceGroupType; label: string; pageHref: string }[] = [
  { type: 'issues', label: 'Issues', pageHref: '/projects/[id]/issues' },
  { type: 'feedback', label: 'Feedback', pageHref: '/projects/[id]/sessions' },
  { type: 'customers', label: 'Customers', pageHref: '/projects/[id]/customers' },
  { type: 'scopes', label: 'Scopes', pageHref: '/projects/[id]/products' },
]
