'use client'

import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import type { DistributionDataPoint } from '@/lib/db/queries/analytics'

// Color palette for slices
const COLORS = [
  '#94a3b8',  // slate-400
  '#7dd3fc',  // sky-300
  '#6ee7b7',  // emerald-300
  '#fcd34d',  // amber-300
  '#fda4af',  // rose-300
  '#a5b4fc',  // indigo-300
]

interface PieChartProps {
  data: DistributionDataPoint[]
  height?: number
  showLegend?: boolean
  innerRadius?: number
  labelFormatter?: (label: string) => string
  colorMap?: Record<string, string>
}

export function PieChart({
  data,
  height = 300,
  showLegend = true,
  innerRadius = 0,
  labelFormatter,
  colorMap,
}: PieChartProps) {
  const formatLabel = labelFormatter ?? ((label: string) => label.replace(/_/g, ' '))

  const chartData = data.map((d) => ({
    ...d,
    name: formatLabel(d.label),
  }))

  const getColor = (label: string, index: number) => {
    if (colorMap?.[label]) return colorMap[label]
    return COLORS[index % COLORS.length]
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={(props) => {
            const { name, percentage } = props as unknown as { name: string; percentage: number }
            return percentage > 5 ? `${name} (${percentage}%)` : ''
          }}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.label} fill={getColor(entry.label, index)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          formatter={(value, name, props) => {
            const percentage = (props.payload as { percentage: number }).percentage
            return [`${value} (${percentage}%)`, name]
          }}
        />
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}
