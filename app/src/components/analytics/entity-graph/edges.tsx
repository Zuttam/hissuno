'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge, type EdgeProps } from '@xyflow/react'
import { Spinner } from '@/components/ui/spinner'
import { getEdgeEntities } from '@/lib/api/analytics'
import { HEX_COLORS } from './nodes'
import type { EdgeEntitiesData } from '@/lib/db/queries/analytics/types'

// ---------------------------------------------------------------------------
// GradientEdge data
// ---------------------------------------------------------------------------

export interface GradientEdgeData {
  count: number
  maxCount: number
  sourceCategory: string
  targetCategory: string
  projectId: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// GradientEdge component
// ---------------------------------------------------------------------------

export function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as GradientEdgeData

  const [isHovered, setIsHovered] = useState(false)
  const [edgeEntities, setEdgeEntities] = useState<EdgeEntitiesData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasFetched = useRef(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const gradientId = `gradient-${id}`
  const sourceColor = HEX_COLORS[edgeData.sourceCategory] ?? '#666'
  const targetColor = HEX_COLORS[edgeData.targetCategory] ?? '#666'
  const strokeWidth = Math.max(1.5, (edgeData.count / edgeData.maxCount) * 4)

  // Lazy-fetch edge entities on first hover
  useEffect(() => {
    if (!isHovered || hasFetched.current) return
    hasFetched.current = true
    setIsLoading(true)
    getEdgeEntities(edgeData.projectId, edgeData.sourceCategory, edgeData.targetCategory, 10)
      .then(result => { if (result) setEdgeEntities(result) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isHovered, edgeData.projectId, edgeData.sourceCategory, edgeData.targetCategory])

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setIsHovered(false), 200)
  }, [])

  useEffect(() => {
    return () => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current) }
  }, [])

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.4} />
        </linearGradient>
      </defs>

      {/* Invisible wide hit area for easy hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible gradient edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth,
          transition: 'stroke-width 200ms ease',
          pointerEvents: 'none',
        }}
      />

      {/* Edge hover panel */}
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-2 font-mono text-xs shadow-md"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              minWidth: 200,
              maxWidth: 280,
              zIndex: 1000,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Spinner size="sm" />
              </div>
            ) : edgeEntities && edgeEntities.pairs.length > 0 ? (
              <>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-secondary)]">
                  {edgeEntities.totalCount} connection{edgeEntities.totalCount !== 1 ? 's' : ''}
                </div>
                <ul className="flex flex-col gap-1">
                  {edgeEntities.pairs.map((pair, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span style={{ color: sourceColor }} className="max-w-[100px] truncate">
                        {pair.source.label}
                      </span>
                      <span className="text-[color:var(--text-tertiary)]">-</span>
                      <span style={{ color: targetColor }} className="max-w-[100px] truncate">
                        {pair.target.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {edgeEntities.totalCount > edgeEntities.pairs.length && (
                  <div className="mt-1 text-[9px] text-[color:var(--text-tertiary)]">
                    +{edgeEntities.totalCount - edgeEntities.pairs.length} more
                  </div>
                )}
              </>
            ) : (
              <div className="text-[10px] text-[color:var(--text-secondary)]">
                {edgeData.count} connection{edgeData.count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
