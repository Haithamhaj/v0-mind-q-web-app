"use client";

import React, { useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import { ChevronsUp } from "lucide-react";

const DEFAULT_COLORS = ["#1d4ed8", "#9333ea", "#0ea5e9", "#16a34a", "#f97316", "#f43f5e", "#10b981"];

type ChartType = "line" | "bar" | "area" | "funnel" | "treemap" | "combo";

type ChartContainerProps = {
  type: ChartType;
  data: Record<string, unknown>[];
  x: string;
  y: string | string[];
  secondaryY?: string | string[];
  height?: number;
  palette?: string[];
  loading?: boolean;
  emptyMessage?: string;
  onPointClick?: (payload: Record<string, unknown>) => void;
  debugId?: string;
};

const ensureArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
    {message}
  </div>
);

export const ChartContainer: React.FC<ChartContainerProps> = ({
  type,
  data,
  x,
  y,
  secondaryY,
  height = 280,
  palette = DEFAULT_COLORS,
  loading = false,
  emptyMessage = "لا توجد بيانات لعرض المخطط.",
  onPointClick,
  debugId = "unknown",
}) => {
  const primary = ensureArray(y);
  const secondarySeries = ensureArray(secondaryY);
  
  useEffect(() => {
    console.log(`[${debugId}] ChartContainer mounted/updated with:`, {
      type,
      dataLength: data?.length,
      x,
      y,
      primary,
      sampleData: data?.slice(0, 2)
    });
  }, [debugId, type, data, x, y, primary]);
  
  console.log(`[${debugId}] ChartContainer received type: ${type}, data length: ${data.length}, primary series: ${primary}, secondary series: ${secondarySeries}`);
  console.log(`[${debugId}] ChartContainer raw props:`, { type, data: data?.slice(0, 2), x, y, secondaryY });
  if (loading) {
    return (
      <div className="h-[280px] w-full animate-pulse rounded-2xl border border-border/30 bg-muted/50" aria-hidden="true" />
    );
  }

  if (!data || !data.length || !primary.length) {
    console.log(`[${debugId}] Returning empty state: data=${!!data}, data.length=${data?.length}, primary.length=${primary.length}`);
    return <EmptyState message={emptyMessage} />;
  }

  const handleClick = (payload: any) => {
    if (onPointClick && payload && payload.payload) {
      onPointClick(payload.payload);
    }
  };

  const baseMargin = { top: 16, right: 24, bottom: 16, left: 24 };

  const renderChart = (width: number, innerHeight: number) => {
    const chartHeight = innerHeight > 0 ? innerHeight : height;
    console.log(`Rendering ${type} chart`);
    switch (type) {
      case "line":
        return (
          <LineChart width={width} height={chartHeight} data={data} margin={baseMargin} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={x} />
            <YAxis />
            <Tooltip />
            <Legend />
            {primary.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={palette[index % palette.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        );
      case "bar":
        return (
          <BarChart width={width} height={chartHeight} data={data} margin={baseMargin} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={x} />
            <YAxis />
            <Tooltip />
            <Legend />
            {primary.map((key, index) => (
              <Bar key={key} dataKey={key} fill={palette[index % palette.length]} radius={[8, 8, 0, 0]} />
            ))}
          </BarChart>
        );
      case "area":
        return (
          <AreaChart width={width} height={chartHeight} data={data} margin={baseMargin} onClick={handleClick}>
            <defs>
              {primary.map((key, index) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette[index % palette.length]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={palette[index % palette.length]} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={x} />
            <YAxis />
            <Tooltip />
            <Legend />
            {primary.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={palette[index % palette.length]}
                fill={`url(#grad-${key})`}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        );
      case "funnel":
        return (
          <FunnelChart width={width} height={chartHeight}>
            <Tooltip />
            <Funnel
              data={data}
              dataKey={primary[0]}
              nameKey={x}
              isAnimationActive={false}
              stroke="#1f2937"
              onClick={handleClick}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        );
      case "treemap":
        return (
          <Treemap
            width={width}
            height={chartHeight}
            data={data.map((item, index) => ({ ...item, fill: palette[index % palette.length] }))}
            dataKey={primary[0]}
            nameKey={x}
            stroke="#1f2937"
            animationDuration={0}
          />
        );
      case "combo":
        return (
          <ComposedChart width={width} height={chartHeight} data={data} margin={baseMargin} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey={x} />
            <YAxis />
            <Tooltip />
            <Legend />
            {primary.map((key, index) => (
              <Bar key={key} dataKey={key} fill={palette[index % palette.length]} radius={[6, 6, 0, 0]} />
            ))}
            {secondarySeries.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={palette[(primary.length + index) % palette.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ComposedChart>
        );
      default:
        console.log(`Unsupported chart type: ${type}`);
        return null;
    }
  };

  return (
    <div
      className={clsx("relative flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm")}
      dir="rtl"
    >
      <div className="bg-yellow-200 p-2 text-black text-sm mb-2">
        DEBUG: ChartContainer rendering with {data.length} entries, type: {type}, y: {JSON.stringify(primary)}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {(({ width, height: innerHeight }: { width: number; height: number }) => renderChart(width, innerHeight) || <></>) as any}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartContainer;
