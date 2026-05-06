'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResourceGroupType, ResourceGroupItem, ResourceGroupData } from '@/components/layout/sidebar/resource-tree-types'
import { listIssues } from '@/lib/api/issues'
import { listSessions } from '@/lib/api/sessions'
import { listCompanies } from '@/lib/api/companies'
import { listProductScopes } from '@/lib/api/settings'

type GroupsState = Record<ResourceGroupType, ResourceGroupData>

const EMPTY_GROUP: ResourceGroupData = { items: [], total: 0, isLoading: false, error: null }

const INITIAL_STATE: GroupsState = {
  issues: { ...EMPTY_GROUP },
  feedback: { ...EMPTY_GROUP },
  customers: { ...EMPTY_GROUP },
  scopes: { ...EMPTY_GROUP },
}

const LIMIT = 20

async function fetchGroup(
  type: ResourceGroupType,
  projectId: string,
): Promise<{ items: ResourceGroupItem[]; total: number }> {
  switch (type) {
    case 'issues': {
      const { issues, total } = await listIssues(projectId, { limit: LIMIT })
      return {
        total,
        items: issues.map((i) => ({
          id: i.id,
          name: i.name,
          subtitle: [i.type, i.status].filter(Boolean).join(' / '),
          type: 'issues',
        })),
      }
    }
    case 'feedback': {
      const { sessions, total } = await listSessions(projectId, { limit: LIMIT })
      return {
        total,
        items: sessions.map((s) => ({
          id: s.id,
          name: s.name || 'Unnamed session',
          subtitle: s.source ?? undefined,
          type: 'feedback',
        })),
      }
    }
    case 'customers': {
      const { companies, total } = await listCompanies(projectId, { limit: LIMIT })
      const items: ResourceGroupItem[] = []
      for (const c of companies) {
        items.push({
          id: c.id,
          name: c.name,
          subtitle: c.stage ?? undefined,
          type: 'customers',
          subtype: 'company',
        })
        if (c.contacts) {
          for (const contact of c.contacts) {
            items.push({
              id: contact.id,
              name: contact.name,
              subtitle: contact.email ?? undefined,
              type: 'customers',
              subtype: 'contact',
              parentId: c.id,
            })
          }
        }
      }
      return { total, items }
    }
    case 'scopes': {
      const scopes = await listProductScopes(projectId)
      return {
        total: scopes.length,
        items: scopes.slice(0, LIMIT).map((s) => ({
          id: s.id,
          name: s.name,
          subtitle: s.type ?? undefined,
          type: 'scopes',
          parentId: s.parent_id ?? undefined,
        })),
      }
    }
  }
}

export function useResourceTree(projectId: string | null, expandedGroups: Set<ResourceGroupType>) {
  const [groups, setGroups] = useState<GroupsState>(INITIAL_STATE)
  const fetchedRef = useRef<Set<string>>(new Set())
  const prevProjectIdRef = useRef(projectId)

  // Reset when project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      prevProjectIdRef.current = projectId
      setGroups(INITIAL_STATE)
      fetchedRef.current.clear()
    }
  }, [projectId])

  // Fetch group data lazily when expanded
  useEffect(() => {
    if (!projectId) return

    for (const type of expandedGroups) {
      const key = `${projectId}:${type}`
      if (fetchedRef.current.has(key)) continue
      fetchedRef.current.add(key)

      setGroups((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true, error: null },
      }))

      fetchGroup(type, projectId)
        .then(({ items, total }) => {
          setGroups((prev) => ({
            ...prev,
            [type]: { items, total, isLoading: false, error: null },
          }))
        })
        .catch((err) => {
          setGroups((prev) => ({
            ...prev,
            [type]: { ...prev[type], isLoading: false, error: err?.message ?? 'Failed to load' },
          }))
        })
    }
  }, [projectId, expandedGroups])

  const refresh = useCallback((type?: ResourceGroupType) => {
    if (!projectId) return

    if (type) {
      const key = `${projectId}:${type}`
      fetchedRef.current.delete(key)
      // Re-trigger by toggling loading state
      setGroups((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true, error: null },
      }))
      fetchGroup(type, projectId)
        .then(({ items, total }) => {
          setGroups((prev) => ({
            ...prev,
            [type]: { items, total, isLoading: false, error: null },
          }))
          fetchedRef.current.add(key)
        })
        .catch((err) => {
          setGroups((prev) => ({
            ...prev,
            [type]: { ...prev[type], isLoading: false, error: err?.message ?? 'Failed to load' },
          }))
        })
    } else {
      // Refresh all expanded groups
      fetchedRef.current.clear()
      for (const t of expandedGroups) {
        const key = `${projectId}:${t}`
        fetchedRef.current.add(key)
        setGroups((prev) => ({
          ...prev,
          [t]: { ...prev[t], isLoading: true, error: null },
        }))
        fetchGroup(t, projectId)
          .then(({ items, total }) => {
            setGroups((prev) => ({
              ...prev,
              [t]: { items, total, isLoading: false, error: null },
            }))
          })
          .catch((err) => {
            setGroups((prev) => ({
              ...prev,
              [t]: { ...prev[t], isLoading: false, error: err?.message ?? 'Failed to load' },
            }))
          })
      }
    }
  }, [projectId, expandedGroups])

  return { groups, refresh }
}
