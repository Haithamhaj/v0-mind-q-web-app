"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

export const ChartContainerChartJS: React.FC<ChartContainerProps> = ({
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
  
  console.log(`[${debugId}] ChartJS Container received type: ${type}, data length: ${data.length}, primary series: ${primary}, secondary series: ${secondarySeries}`);
  
  if (loading) {
    return (
      <div className="h-[280px] w-full animate-pulse rounded-2xl border border-border/30 bg-muted/50" aria-hidden="true" />
    );
  }

  if (!data || !data.length || !primary.length) {
    console.log(`[${debugId}] ChartJS Returning empty state: data=${!!data}, data.length=${data?.length}, primary.length=${primary.length}`);
    return <EmptyState message={emptyMessage} />;
  }

  // Prepare Chart.js data
  const labels = data.map(item => String(item[x]));
  const datasets = primary.map((key, index) => ({
    label: key,
    data: data.map(item => Number(item[key]) || 0),
    borderColor: palette[index % palette.length],
    backgroundColor: type === 'bar' ? palette[index % palette.length] : `${palette[index % palette.length]}20`,
    borderWidth: 2,
    fill: type === 'area',
    tension: 0.4,
  }));

  // Add secondary series if combo chart
  if (type === 'combo' && secondarySeries.length > 0) {
    secondarySeries.forEach((key, index) => {
      datasets.push({
        label: key,
        data: data.map(item => Number(item[key]) || 0),
        borderColor: palette[(primary.length + index) % palette.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        type: 'line' as const,
        fill: false,
        tension: 0.4,
      });
    });
  }

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        beginAtZero: true,
      },
    },
    onClick: (event: any, elements: any[]) => {
      if (onPointClick && elements.length > 0) {
        const element = elements[0];
        const dataIndex = element.index;
        onPointClick(data[dataIndex]);
      }
    },
  };

  return (
    <div
      className="relative flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm"
      dir="rtl"
      style={{ height: height }}
    >
      <div style={{ height: height - 20 }}>
        {type === 'line' || type === 'area' ? (
          <Line data={chartData} options={options} />
        ) : type === 'bar' ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Chart type "{type}" not supported in ChartJS version
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartContainerChartJS;
