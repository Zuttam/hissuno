'use client'

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { IssueVelocityData } from '@/types/dashboard'

interface VelocityChartProps {
  velocity: IssueVelocityData
}

export function VelocityChart({ velocity }: VelocityChartProps) {
  // Merge created and resolved into unified data points keyed by date
  const dateMap = new Map<string, { date: string; created: number; resolved: number }>()

  for (const point of velocity.created) {
    dateMap.set(point.date, { date: point.date, created: point.count, resolved: 0 })
  }

  for (const point of velocity.resolved) {
    const existing = dateMap.get(point.date)
    if (existing) {
      existing.resolved = point.count
    } else {
      dateMap.set(point.date, { date: point.date, created: 0, resolved: point.count })
    }
  }

  const data = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const hasData = data.some((d) => d.created > 0 || d.resolved > 0)

  const formatDate = (date: unknown) => {
    const d = new Date(date as string | number)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        {!hasData ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <RechartsLineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="var(--text-secondary)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--text-secondary)' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
                labelFormatter={formatDate}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="created"
                name="Created"
                stroke="var(--accent-info)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke="var(--accent-success)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
