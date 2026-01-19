'use client'

import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import type { TimeSeriesDataPoint } from '@/lib/supabase/analytics'

interface SparklineProps {
  data: TimeSeriesDataPoint[]
  color?: string
  height?: number
  width?: number | `${number}%`
}

export function Sparkline({
  data,
  color = 'var(--accent-primary)',
  height = 40,
  width = '100%',
}: SparklineProps) {
  // Take last N points for sparkline display
  const sparklineData = data.slice(-14)

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sparklineGradient-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sparklineGradient-${color.replace(/[^a-z0-9]/gi, '')})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface MiniBarProps {
  data: { label: string; value: number }[]
  colorMap?: Record<string, string>
  height?: number
  width?: number | string
}

const DEFAULT_COLORS = [
  'var(--accent-primary)',
  'var(--accent-info)',
  'var(--accent-success)',
  'var(--accent-warning)',
  'var(--accent-danger)',
]

export function MiniBar({ data, colorMap, height = 24, width = 120 }: MiniBarProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const getColor = (label: string, index: number) => {
    if (colorMap?.[label]) return colorMap[label]
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  }

  return (
    <div
      className="flex overflow-hidden rounded-full"
      style={{ width: typeof width === 'number' ? `${width}px` : width, height: `${height}px` }}
    >
      {data.map((d, i) => (
        <div
          key={d.label}
          className="h-full"
          style={{
            width: `${(d.value / total) * 100}%`,
            backgroundColor: getColor(d.label, i),
          }}
          title={`${d.label}: ${d.value}`}
        />
      ))}
    </div>
  )
}
