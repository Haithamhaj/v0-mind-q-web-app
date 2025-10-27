import type { FC } from "react"
import type { EChartsCoreOption } from "echarts"
import { EChartBase } from "@/src/bi/components/layer2/EChartBase"

const DEFAULT_COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#fbbf24", "#0ea5e9"]

interface BiChartProps {
  data: Array<Record<string, unknown>>
  chartType: "line" | "area" | "bar" | "pie" | string
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

  const first = data[0] ?? {}
  const resolvedXKey = xKey in first ? xKey : Object.keys(first)[0]
  const resolvedValueKey =
    valueKey in first
      ? valueKey
      : (Object.keys(first).find((k) => typeof (first as any)[k] === "number") ?? valueKey)

  const commonAxes: EChartsCoreOption = {
    tooltip: { trigger: chartType === "pie" ? "item" : "axis" },
    grid: { top: 24, right: 16, bottom: 40, left: 40 },
    xAxis: chartType === "pie" ? undefined : { type: "category", data: data.map((d) => String((d as any)[resolvedXKey])) },
    yAxis: chartType === "pie" ? undefined : { type: "value" },
    legend: chartType === "pie" ? { top: 0 } : undefined,
  }

  let option: EChartsCoreOption
  if (chartType === "pie") {
    option = {
      ...commonAxes,
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: true,
          data: data.map((d) => ({
            name: String((d as any)[resolvedXKey]),
            value: Number((d as any)[resolvedValueKey] ?? 0),
          })),
        },
      ],
    }
  } else {
    const seriesType = chartType === "area" ? "line" : chartType === "pareto" ? "bar" : chartType
    option = {
      ...commonAxes,
      series: [
        {
          type: seriesType as any,
          smooth: seriesType === "line",
          areaStyle: chartType === "area" ? {} : undefined,
          data: data.map((d) => Number((d as any)[resolvedValueKey] ?? 0)),
        },
      ],
    }
  }

  return <EChartBase option={option} height={height} />
}

export default BiChart
