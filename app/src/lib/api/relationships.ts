import { fetchApi, fetchApiRaw, buildUrl } from './fetch'
import type { RelatedEntitiesResult } from '@/lib/db/queries/entity-relationships'
import type { EntityType } from '@/lib/db/queries/types'

const PATH = '/api/relationships'

export async function linkEntities(
  projectId: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
) {
  return fetchApiRaw(buildUrl(PATH, { projectId }), {
    method: 'POST',
    body: { source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId },
  })
}

export async function unlinkEntities(
  projectId: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
) {
  return fetchApiRaw(buildUrl(PATH, { projectId }), {
    method: 'DELETE',
    body: { source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId },
  })
}

export async function getRelatedEntities(
  projectId: string,
  entityType: EntityType,
  entityId: string,
) {
  return fetchApi<{ relationships: RelatedEntitiesResult }>(
    buildUrl(PATH, { projectId, entityType, entityId }),
    { errorMessage: 'Failed to load relationships.' },
  )
}
