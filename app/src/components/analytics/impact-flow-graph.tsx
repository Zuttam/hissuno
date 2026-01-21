'use client'

import { useState, useMemo, useCallback } from 'react'
import { SankeyChart } from './charts'
import { Spinner } from '@/components/ui/spinner'
import type {
  ImpactFlowGraphData,
  FlowGraphNode,
  FlowGraphLink,
} from '@/lib/supabase/analytics'

interface ImpactFlowGraphProps {
  data: ImpactFlowGraphData | null
  isLoading?: boolean
  error?: string | null
  projectId?: string
}

const STATUS_LEGEND = [
  { status: 'open', label: 'Open', color: 'var(--accent-warning)' },
  { status: 'ready', label: 'Ready', color: 'var(--accent-info)' },
  { status: 'in_progress', label: 'In Progress', color: 'var(--accent-selected)' },
  { status: 'resolved', label: 'Resolved', color: 'var(--accent-success)' },
  { status: 'closed', label: 'Closed', color: 'var(--accent-primary)' },
]

export function ImpactFlowGraph({ data, isLoading, error, projectId }: ImpactFlowGraphProps) {
  const [expandedUsers, setExpandedUsers] = useState(false)

  const handleNodeClick = useCallback((node: FlowGraphNode) => {
    if (node.expandable && node.id.includes('user')) {
      setExpandedUsers((prev) => !prev)
    }
  }, [])

  // Build expanded graph data when users are expanded
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] }

    if (!expandedUsers) {
      return { nodes: data.nodes, links: data.links }
    }

    // Expand users: Replace aggregated Users node with individual user nodes
    const nodes: FlowGraphNode[] = []
    const links: FlowGraphLink[] = []

    // Find the sessions node index in original data
    const sessionsNodeOriginalIdx = data.nodes.findIndex((n) => n.id === 'sessions')
    if (sessionsNodeOriginalIdx === -1) {
      return { nodes: data.nodes, links: data.links }
    }

    // Copy source nodes
    const sourceNodes = data.nodes.filter((n) => n.category === 'source')
    sourceNodes.forEach((node) => nodes.push({ ...node }))

    // Add individual user nodes instead of aggregated
    const userNodeStartIdx = nodes.length
    data.users.forEach((user) => {
      nodes.push({
        id: `user-${user.id}`,
        name: `${user.displayName} (${user.sessionCount})`,
        category: 'participant',
        color: 'var(--accent-info)',
      })
    })

    if (data.remainingUsersCount > 0) {
      nodes.push({
        id: 'user-more',
        name: `+${data.remainingUsersCount} more`,
        category: 'participant',
        color: 'var(--accent-primary)',
      })
    }

    // Add sessions node
    const sessionsNodeIdx = nodes.length
    const sessionsNode = data.nodes.find((n) => n.id === 'sessions')
    if (sessionsNode) {
      nodes.push({ ...sessionsNode, expandable: true })
    }

    // Add issue nodes
    const issueNodeStartIdx = nodes.length
    const issueNodes = data.nodes.filter((n) => n.category === 'issue')
    issueNodes.forEach((node) => nodes.push({ ...node }))

    // Links: Sources → Users (distribute proportionally)
    const totalSessions = data.totals.sessions
    const totalUserSessions = data.users.reduce((sum, u) => sum + u.sessionCount, 0)
    const remainingUserSessions = totalSessions - totalUserSessions

    sourceNodes.forEach((_, sourceIdx) => {
      const sourceValue =
        data.links.find((l) => l.source === sourceIdx && l.target === sessionsNodeOriginalIdx)
          ?.value ?? 0
      if (sourceValue === 0) return

      // Distribute source value across users proportionally
      data.users.forEach((user, userIdx) => {
        const proportion = user.sessionCount / totalSessions
        const value = Math.round(sourceValue * proportion)
        if (value > 0) {
          links.push({
            source: sourceIdx,
            target: userNodeStartIdx + userIdx,
            value,
          })
        }
      })

      // Add link to "+X more" node if there are remaining users
      if (data.remainingUsersCount > 0 && remainingUserSessions > 0) {
        const proportion = remainingUserSessions / totalSessions
        const value = Math.round(sourceValue * proportion)
        if (value > 0) {
          links.push({
            source: sourceIdx,
            target: userNodeStartIdx + data.users.length,
            value,
          })
        }
      }
    })

    // Links: Users → Sessions
    data.users.forEach((user, userIdx) => {
      links.push({
        source: userNodeStartIdx + userIdx,
        target: sessionsNodeIdx,
        value: user.sessionCount,
      })
    })

    if (data.remainingUsersCount > 0 && remainingUserSessions > 0) {
      links.push({
        source: userNodeStartIdx + data.users.length,
        target: sessionsNodeIdx,
        value: remainingUserSessions,
      })
    }

    // Links: Sessions → Issues (copy from original)
    const originalIssueLinks = data.links.filter(
      (l) => l.source === sessionsNodeOriginalIdx && data.nodes[l.target]?.category === 'issue'
    )
    originalIssueLinks.forEach((link) => {
      const originalIssueNode = data.nodes[link.target]
      const newIssueIdx = nodes.findIndex((n) => n.id === originalIssueNode.id)
      if (newIssueIdx !== -1) {
        links.push({
          source: sessionsNodeIdx,
          target: newIssueIdx,
          value: link.value,
        })
      }
    })

    return { nodes, links }
  }, [data, expandedUsers])

  if (isLoading) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-[color:var(--accent-danger)]">
        {error}
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-[color:var(--text-secondary)]">
        No data available for the selected period
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
          Issue Status:
        </span>
        {STATUS_LEGEND.map(({ status, label, color }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="font-mono text-xs text-[color:var(--text-secondary)]">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <SankeyChart
        data={graphData}
        height={expandedUsers ? 450 : 350}
        onNodeClick={handleNodeClick}
        tooltipData={data.tooltipData}
        projectId={projectId}
      />

      {/* Summary Stats */}
      <div className="flex items-center gap-6 border-t border-[color:var(--border-subtle)] pt-4">
        <div className="font-mono text-sm">
          <span className="text-[color:var(--text-secondary)]">Sessions: </span>
          <span className="font-semibold text-[color:var(--foreground)]">
            {data.totals.sessions.toLocaleString()}
          </span>
        </div>
        <div className="font-mono text-sm">
          <span className="text-[color:var(--text-secondary)]">Issues: </span>
          <span className="font-semibold text-[color:var(--foreground)]">
            {data.totals.issues.toLocaleString()}
          </span>
        </div>
        <div className="font-mono text-sm">
          <span className="text-[color:var(--text-secondary)]">Conversion: </span>
          <span className="font-semibold text-[color:var(--foreground)]">
            {data.totals.conversionRate}%
          </span>
        </div>
        {data.users.length > 0 && (
          <button
            onClick={() => setExpandedUsers((prev) => !prev)}
            className="ml-auto font-mono text-xs text-[color:var(--accent-selected)] hover:underline"
          >
            {expandedUsers ? 'Collapse users' : `Show ${data.users.length + (data.remainingUsersCount > 0 ? '+' : '')} users`}
          </button>
        )}
      </div>
    </div>
  )
}
