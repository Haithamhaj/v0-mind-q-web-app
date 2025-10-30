"use client"

import type { FC } from "react"
import { BiChart } from "@/components/bi-chart"
import { HeatmapChart } from "@/src/bi/components/layer2/HeatmapChart"
import { BoxPlotChart } from "@/src/bi/components/layer2/BoxPlotChart"
import { WaterfallChart } from "@/src/bi/components/layer2/WaterfallChart"
import { ScatterChart } from "@/src/bi/components/layer2/ScatterChart"
import { MultiAxisLineChart } from "@/src/bi/components/layer2/MultiAxisLineChart"

export type VizSpec = {
  engine?: "echarts"
  chartType?: string
  xKey?: string
  valueKey?: string
}

export const VisualizationAdapter: FC<{
  data: Array<Record<string, unknown>>
  viz: VizSpec
  height?: number
}> = ({ data, viz, height = 320 }) => {
  const type = (viz.chartType || "bar").toLowerCase()

  switch (type) {
    case "heatmap":
      return <HeatmapChart data={data} height={height} />
    case "boxplot":
      return <BoxPlotChart data={data} height={height} />
    case "waterfall":
      return <WaterfallChart data={data} height={height} />
    case "scatter":
      return <ScatterChart data={data} height={height} />
    case "multi-axis":
    case "multi-line":
      return <MultiAxisLineChart data={data} height={height} />
    default:
      return (
        <BiChart
          data={data}
          chartType={type}
          xKey={viz.xKey ?? "dt"}
          valueKey={viz.valueKey ?? "val"}
          height={height}
        />
      )
  }
}

export default VisualizationAdapter


