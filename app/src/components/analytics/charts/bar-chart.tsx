'use client'

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import type { DistributionDataPoint } from '@/lib/supabase/analytics'

// Color palette for bars
const COLORS = [
  'var(--accent-primary)',
  'var(--accent-info)',
  'var(--accent-success)',
  'var(--accent-warning)',
  'var(--accent-danger)',
  'var(--accent-selected)',
]

interface BarChartProps {
  data: DistributionDataPoint[]
  height?: number
  showGrid?: boolean
  horizontal?: boolean
  labelFormatter?: (label: string) => string
  colorMap?: Record<string, string>
}

export function BarChart({
  data,
  height = 300,
  showGrid = false,
  horizontal = false,
  labelFormatter,
  colorMap,
}: BarChartProps) {
  const formatLabel = labelFormatter ?? ((label: string) => label.replace(/_/g, ' '))

  const chartData = data.map((d) => ({
    ...d,
    displayLabel: formatLabel(d.label),
  }))

  const getColor = (label: string, index: number) => {
    if (colorMap?.[label]) return colorMap[label]
    return COLORS[index % COLORS.length]
  }

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              strokeOpacity={0.5}
              horizontal={false}
            />
          )}
          <XAxis
            type="number"
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <YAxis
            type="category"
            dataKey="displayLabel"
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)' }}
            width={75}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
            formatter={(value, _name, props) => {
              const percentage = (props.payload as { percentage: number }).percentage
              return [`${value} (${percentage}%)`, 'Count']
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.label} fill={getColor(entry.label, index)} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            strokeOpacity={0.5}
            vertical={false}
          />
        )}
        <XAxis
          dataKey="displayLabel"
          stroke="var(--text-secondary)"
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          tick={{ fill: 'var(--text-secondary)' }}
        />
        <YAxis
          stroke="var(--text-secondary)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-secondary)' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          formatter={(value, _name, props) => {
            const percentage = (props.payload as { percentage: number }).percentage
            return [`${value} (${percentage}%)`, 'Count']
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={entry.label} fill={getColor(entry.label, index)} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
