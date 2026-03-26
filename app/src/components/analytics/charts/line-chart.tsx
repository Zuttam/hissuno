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
import type { TimeSeriesPoint } from '@/lib/db/queries/analytics'

interface LineChartProps {
  data: TimeSeriesPoint[]
  dataKey?: string
  color?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  label?: string
  formatDate?: (date: string) => string
  formatValue?: (value: number) => string
}

export function LineChart({
  data,
  dataKey = 'count',
  color = 'var(--accent-primary)',
  height = 300,
  showGrid = true,
  showLegend = false,
  label = 'Count',
  formatDate,
  formatValue,
}: LineChartProps) {
  const defaultFormatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const tickFormatter = formatDate ?? defaultFormatDate
  const valueFormatter = formatValue ?? ((v: number) => v.toString())

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            strokeOpacity={0.5}
          />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={tickFormatter}
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
          tickFormatter={(v) => valueFormatter(v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          labelFormatter={(label) => tickFormatter(String(label))}
          formatter={(value) => [valueFormatter(Number(value ?? 0)), label]}
        />
        {showLegend && <Legend />}
        <Line
          type="monotone"
          dataKey={dataKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
