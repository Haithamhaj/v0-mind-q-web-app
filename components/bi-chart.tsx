import type { FC } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const DEFAULT_COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#fbbf24", "#0ea5e9"]

interface BiChartProps {
  data: Array<Record<string, unknown>>
  chartType: string
  xKey: string
  valueKey?: string
  height?: number
}

export const BiChart: FC<BiChartProps> = ({ data, chartType, xKey, valueKey = "val", height = 320 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No data available for this query.
      </div>
    )
  }

  const resolvedValueKey =
    valueKey in data[0]
      ? valueKey
      : Object.keys(data[0]).find((key) => {
          const value = data[0]?.[key]
          return typeof value === "number"
        }) ?? valueKey

  const resolvedXKey = xKey in data[0] ? xKey : Object.keys(data[0])[0]

  const renderLine = (type: "line" | "area") => (
    <ResponsiveContainer width="100%" height={height}>
      {type === "line" ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey={resolvedXKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey={resolvedValueKey} stroke="#2563eb" dot={false} strokeWidth={2} />
        </LineChart>
      ) : (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey={resolvedXKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={resolvedValueKey}
            stroke="#2563eb"
            fill="#4f46e5"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  )

  const renderBar = () => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey={resolvedXKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Bar dataKey={resolvedValueKey} fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  )

  const renderPie = () => (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip />
        <Pie
          data={data}
          dataKey={resolvedValueKey}
          nameKey={resolvedXKey}
          cx="50%"
          cy="50%"
          outerRadius={Math.min(height / 2.2, 180)}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )

  switch (chartType) {
    case "line":
      return renderLine("line")
    case "area":
      return renderLine("area")
    case "bar":
    case "pareto":
      return renderBar()
    case "pie":
      return renderPie()
    default:
      return renderBar()
  }
}

export default BiChart
