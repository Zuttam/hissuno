'use client'

import { useState } from 'react'
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import type {
  FlowGraphNode,
  FlowGraphLink,
  FlowGraphTooltipData,
  FlowGraphSession,
  FlowGraphIssue,
} from '@/lib/supabase/analytics'

interface SankeyChartProps {
  data: {
    nodes: FlowGraphNode[]
    links: FlowGraphLink[]
  }
  height?: number
  nodeWidth?: number
  nodePadding?: number
  onNodeClick?: (node: FlowGraphNode) => void
  tooltipData?: FlowGraphTooltipData
  projectId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomNodeRenderer(props: any, onNodeClick?: (node: FlowGraphNode) => void) {
  const { x, y, width, height, payload } = props

  // Extract our custom properties from payload (Recharts spreads node data onto payload)
  const nodeData = payload as FlowGraphNode & { value?: number }
  const isClickable = nodeData.expandable
  const fillColor = nodeData.color ?? 'var(--accent-primary)'

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillColor}
        fillOpacity={0.9}
        stroke={fillColor}
        strokeWidth={1}
        radius={2}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
        onClick={() => isClickable && onNodeClick?.(nodeData)}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fill="var(--foreground)"
        fontSize={12}
        fontFamily="var(--font-mono)"
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
        onClick={() => isClickable && onNodeClick?.(nodeData)}
      >
        {nodeData.name}
      </text>
    </Layer>
  )
}

// Recharts Sankey tooltip payload - the structure varies
 
interface RichTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      source: FlowGraphNode | number
      target: FlowGraphNode | number
      value: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any
    }
    name?: string
    value?: number
  }>
  tooltipData?: FlowGraphTooltipData
  projectId?: string
}

function SessionsList({
  sessions,
  projectId,
  expanded,
  onToggle,
}: {
  sessions: FlowGraphSession[]
  projectId?: string
  expanded: boolean
  onToggle: () => void
}) {
  const displaySessions = expanded ? sessions : sessions.slice(0, 3)
  const hasMore = sessions.length > 3

  return (
    <div className="mt-2 space-y-1">
      {displaySessions.map((session) => (
        <a
          key={session.id}
          href={projectId ? `/projects/${projectId}/sessions/${session.id}` : `/sessions/${session.id}`}
          className="block rounded px-1.5 py-1 text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="truncate">
            {session.name || `Session ${session.id.slice(0, 8)}`}
          </div>
          <div className="text-[10px] text-[color:var(--text-tertiary)]">
            {session.messageCount} messages
          </div>
        </a>
      ))}
      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="w-full px-1.5 py-1 text-left text-[10px] text-[color:var(--accent-selected)] hover:underline"
        >
          {expanded ? 'Show less' : `+${sessions.length - 3} more sessions`}
        </button>
      )}
    </div>
  )
}

function IssuesList({
  issues,
  projectId,
}: {
  issues: FlowGraphIssue[]
  projectId?: string
}) {
  return (
    <div className="mt-2 space-y-1">
      {issues.slice(0, 5).map((issue) => (
        <a
          key={issue.id}
          href={projectId ? `/projects/${projectId}/issues/${issue.id}` : `/issues/${issue.id}`}
          className="block rounded px-1.5 py-1 text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="truncate">{issue.title}</div>
          <div className="flex items-center gap-2 text-[10px] text-[color:var(--text-tertiary)]">
            <span className="capitalize">{issue.type.replace('_', ' ')}</span>
            {issue.upvoteCount > 0 && <span>+{issue.upvoteCount}</span>}
          </div>
        </a>
      ))}
      {issues.length > 5 && (
        <div className="px-1.5 py-1 text-[10px] text-[color:var(--text-tertiary)]">
          +{issues.length - 5} more issues
        </div>
      )}
    </div>
  )
}

function UserDetails({
  user,
  projectId,
}: {
  user: { id: string; displayName: string; sessionCount: number; email?: string; sessions: FlowGraphSession[] }
  projectId?: string
}) {
  return (
    <div className="mt-2">
      <div className="text-[color:var(--foreground)]">{user.displayName}</div>
      {user.email && user.email !== user.displayName && (
        <div className="text-[10px] text-[color:var(--text-tertiary)]">{user.email}</div>
      )}
      <div className="mt-1 text-[10px] text-[color:var(--text-secondary)]">
        {user.sessionCount} session{user.sessionCount !== 1 ? 's' : ''}
      </div>
      {user.sessions.length > 0 && (
        <div className="mt-2 border-t border-[color:var(--border-subtle)] pt-2">
          <div className="text-[10px] uppercase text-[color:var(--text-tertiary)]">Recent Sessions</div>
          {user.sessions.slice(0, 3).map((session) => (
            <a
              key={session.id}
              href={projectId ? `/projects/${projectId}/sessions/${session.id}` : `/sessions/${session.id}`}
              className="mt-1 block truncate text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]"
              onClick={(e) => e.stopPropagation()}
            >
              {session.name || `Session ${session.id.slice(0, 8)}`}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function RichTooltip({ active, payload, tooltipData, projectId }: RichTooltipProps) {
  const [expandedSessions, setExpandedSessions] = useState(false)

  if (!active || !payload || payload.length === 0) return null

  // Recharts Sankey tooltip structure:
  // payload[0].payload - the raw link data with source/target as node objects
  // payload[0].name - formatted as "sourceName - targetName"
  // payload[0].value - the link value
  const linkData = payload[0].payload
  const formattedName = payload[0].name ?? ''

  // The source and target on the link payload should be the resolved node objects
  // with all our custom properties (id, name, category, etc.)
  const sourceNode = linkData?.source as FlowGraphNode | undefined
  const targetNode = linkData?.target as FlowGraphNode | undefined

  // Extract node identifiers from the node objects
  const sourceId = sourceNode?.id
  const targetId = targetNode?.id
  const sourceName = sourceNode?.name ?? ''
  const targetName = targetNode?.name ?? ''
  const sourceCategory = sourceNode?.category
  const targetCategory = targetNode?.category

  // Fallback: parse from formatted name if node objects don't have our properties
  const [parsedSourceName, parsedTargetName] = formattedName?.includes(' - ')
    ? formattedName.split(' - ')
    : [sourceName, targetName]

  const displaySourceName = sourceName || parsedSourceName || 'Source'
  const displayTargetName = targetName || parsedTargetName || 'Target'
  const linkValue = linkData?.value ?? 0

  // Determine tooltip content based on target node category
  const renderContent = () => {
    // Issue node: show list of issues with links
    if (targetCategory === 'issue' && tooltipData?.issuesByStatus && targetId) {
      const status = targetId.replace('issue-', '')
      const issues = tooltipData.issuesByStatus[status] || []

      if (issues.length > 0) {
        return (
          <>
            <div className="text-[color:var(--text-secondary)]">
              {displaySourceName} → {displayTargetName}
            </div>
            <div className="mt-1 font-semibold text-[color:var(--foreground)]">
              {linkValue.toLocaleString()} session{linkValue !== 1 ? 's' : ''}
            </div>
            <IssuesList issues={issues} projectId={projectId} />
          </>
        )
      }
    }

    // Source node → Sessions: show sessions list
    if (sourceCategory === 'source' && targetId === 'sessions' && tooltipData?.sessionsBySource && sourceId) {
      const source = sourceId.replace('source-', '')
      const sessions = tooltipData.sessionsBySource[source] || []

      if (sessions.length > 0) {
        return (
          <>
            <div className="text-[color:var(--text-secondary)]">
              {displaySourceName} → {displayTargetName}
            </div>
            <div className="mt-1 font-semibold text-[color:var(--foreground)]">
              {linkValue.toLocaleString()} session{linkValue !== 1 ? 's' : ''}
            </div>
            <SessionsList
              sessions={sessions}
              projectId={projectId}
              expanded={expandedSessions}
              onToggle={() => setExpandedSessions(!expandedSessions)}
            />
          </>
        )
      }
    }

    // User node → Sessions: show user details
    if (sourceCategory === 'participant' && sourceId?.startsWith('user-') && tooltipData?.userDetails) {
      const userId = sourceId.replace('user-', '')
      const userDetail = tooltipData.userDetails[userId]

      if (userDetail) {
        return (
          <>
            <div className="text-[color:var(--text-secondary)]">
              User → {displayTargetName}
            </div>
            <div className="mt-1 font-semibold text-[color:var(--foreground)]">
              {linkValue.toLocaleString()} session{linkValue !== 1 ? 's' : ''}
            </div>
            <UserDetails user={userDetail} projectId={projectId} />
          </>
        )
      }
    }

    // Default tooltip - show source → target with value
    return (
      <>
        <div className="text-[color:var(--text-secondary)]">
          {displaySourceName} → {displayTargetName}
        </div>
        <div className="mt-1 font-semibold text-[color:var(--foreground)]">
          {linkValue.toLocaleString()}
        </div>
      </>
    )
  }

  return (
    <div
      className="max-h-[300px] max-w-[280px] overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-xs shadow-md"
    >
      {renderContent()}
    </div>
  )
}

export function SankeyChart({
  data,
  height = 400,
  nodeWidth = 10,
  nodePadding = 24,
  onNodeClick,
  tooltipData,
  projectId,
}: SankeyChartProps) {
  if (data.nodes.length === 0 || data.links.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[color:var(--text-secondary)]"
        style={{ height }}
      >
        No flow data available
      </div>
    )
  }

  // Transform data for Recharts Sankey
  const sankeyData = {
    nodes: data.nodes.map((node) => ({
      ...node,
      name: node.name,
    })),
    links: data.links.map((link) => ({
      ...link,
      source: link.source,
      target: link.target,
      value: link.value,
    })),
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={sankeyData}
        nodeWidth={nodeWidth}
        nodePadding={nodePadding}
        linkCurvature={0.5}
        iterations={32}
        node={(props) => CustomNodeRenderer(props, onNodeClick)}
        link={{
          stroke: 'var(--border-subtle)',
          strokeOpacity: 0.4,
        }}
        margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
      >
        <Tooltip
          content={<RichTooltip tooltipData={tooltipData} projectId={projectId} />}
          wrapperStyle={{ zIndex: 1000 }}
        />
      </Sankey>
    </ResponsiveContainer>
  )
}
