'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RelatedEntitiesResult } from '@/lib/db/queries/entity-relationships'
import type { EntityType } from '@/lib/db/queries/types'
import {
  getRelatedEntities,
  linkEntities as apiLink,
  unlinkEntities as apiUnlink,
} from '@/lib/api/relationships'

const EMPTY: RelatedEntitiesResult = {
  companies: [],
  contacts: [],
  issues: [],
  sessions: [],
  knowledgeSources: [],
  productScopes: [],
}

interface UseEntityRelationshipsOptions {
  projectId?: string | null
  entityType: EntityType
  entityId?: string | null
}

interface UseEntityRelationshipsState {
  relationships: RelatedEntitiesResult
  isLoading: boolean
  link: (targetType: EntityType, targetId: string) => Promise<boolean>
  unlink: (targetType: EntityType, targetId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useEntityRelationships({
  projectId,
  entityType,
  entityId,
}: UseEntityRelationshipsOptions): UseEntityRelationshipsState {
  const [relationships, setRelationships] = useState<RelatedEntitiesResult>(EMPTY)
  const [isLoading, setIsLoading] = useState(Boolean(projectId && entityId))

  const fetchRelationships = useCallback(async () => {
    if (!projectId || !entityId) {
      setRelationships(EMPTY)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const payload = await getRelatedEntities(projectId, entityType, entityId)
      setRelationships(payload.relationships)
    } catch {
      setRelationships(EMPTY)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, entityType, entityId])

  const link = useCallback(
    async (targetType: EntityType, targetId: string): Promise<boolean> => {
      if (!projectId || !entityId) return false

      try {
        const res = await apiLink(projectId, entityType, entityId, targetType, targetId)
        if (res.ok) {
          await fetchRelationships()
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [projectId, entityType, entityId, fetchRelationships],
  )

  const unlink = useCallback(
    async (targetType: EntityType, targetId: string): Promise<boolean> => {
      if (!projectId || !entityId) return false

      try {
        const res = await apiUnlink(projectId, entityType, entityId, targetType, targetId)
        if (res.ok) {
          await fetchRelationships()
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [projectId, entityType, entityId, fetchRelationships],
  )

  useEffect(() => {
    void fetchRelationships()
  }, [fetchRelationships])

  return useMemo(
    () => ({ relationships, isLoading, link, unlink, refresh: fetchRelationships }),
    [relationships, isLoading, link, unlink, fetchRelationships],
  )
}
