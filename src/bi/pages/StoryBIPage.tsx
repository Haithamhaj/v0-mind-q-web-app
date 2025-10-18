'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, FilterBar, KpiCard, NarrativeFeed, SidePanel } from '../components';
import {
  BiDataProvider,
  useBiData,
  useBiDimensions,
  useFilteredDataset,
  useBiInsights,
  useBiMetrics,
} from '../data';
import type { Insight, MetricSpec } from '../data';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type TabConfig = {
  id: string;
  label: string;
  metricId?: string;
  dimension?: string;
  chartType?: 'line' | 'bar' | 'area' | 'funnel' | 'treemap' | 'combo';
};

type RawMetricsBreakdownValue = {
  value: string;
  orders: number;
  share_pct?: number | null;
  delivered?: number | null;
  out_for_delivery?: number | null;
  returned?: number | null;
  cod_total?: number | null;
};

type RawMetricsChart = {
  title?: string;
  type: 'line' | 'bar' | 'area' | 'funnel' | 'treemap' | 'combo';
  x: string;
  y: string[];
  secondary_y?: string[];
  data: Array<Record<string, string | number>>;
};

type RawMetricsBreakdown = {
  dimension: string;
  label: string;
  values: RawMetricsBreakdownValue[];
  chart?: RawMetricsChart;
};

type RawMetricsTrends = {
  daily?: RawMetricsChart;
  hour_of_day?: RawMetricsChart;
  weekday?: RawMetricsChart;
};

type ChartSeriesMeta = {
  key: keyof RawMetricsBreakdownValue;
  label: string;
  kind: "count" | "percentage" | "amount";
};

const BREAKDOWN_SERIES_META: ChartSeriesMeta[] = [
  { key: "orders", label: "الطلبات", kind: "count" },
  { key: "share_pct", label: "الحصة %", kind: "percentage" },
  { key: "delivered", label: "تم التسليم", kind: "count" },
  { key: "out_for_delivery", label: "قيد التسليم", kind: "count" },
  { key: "returned", label: "مرتجع", kind: "count" },
  { key: "cod_total", label: "تحصيل COD", kind: "amount" },
];

type AggregatedTrendStats = {
  key: number;
  label: string;
  orders: number;
  amount: number;
  cod: number;
};

type TrendBuckets = {
  daily: AggregatedTrendStats[];
  weekday: AggregatedTrendStats[];
  hour: AggregatedTrendStats[];
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]+/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
      return undefined;
    }
    const normalised = Number(cleaned);
    if (Number.isFinite(normalised)) {
      return normalised;
    }
  }
  return undefined;
};

const ensureDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const numeric = toNumber(value);
  if (numeric !== undefined) {
    const timestamp = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

const hasChartData = (chart?: RawMetricsChart | null): chart is RawMetricsChart => {
  if (!chart?.data?.length || !chart.y?.length) {
    return false;
  }
  const yKeys = Array.isArray(chart.y) ? chart.y : [chart.y];
  return yKeys.some((key) =>
    chart.data.some((row) => {
      const value = (row as Record<string, unknown>)[key];
      return typeof value === "number" && !Number.isNaN(value);
    }),
  );
};

const buildBreakdownChart = (breakdown: RawMetricsBreakdown): RawMetricsChart | undefined => {
  if (!breakdown.values?.length) {
    return undefined;
  }

  const activeSeries = BREAKDOWN_SERIES_META.filter((meta) =>
    breakdown.values.some((value) => {
      const record = value as Record<string, unknown>;
      const numeric = toNumber(record[meta.key]);
      return numeric !== undefined && Math.abs(numeric) > 0;
    }),
  );

  if (!activeSeries.length) {
    return undefined;
  }

  const data = breakdown.values.map((value) => {
    const record = value as Record<string, unknown>;
    const row: Record<string, string | number> = {
      breakdown: typeof value.value === "string" && value.value.length ? value.value : "غير معروف",
    };

  activeSeries.forEach((meta) => {
    const numeric = toNumber(record[meta.key]);
    if (numeric !== undefined) {
      if (meta.kind === "count") {
        row[meta.label] = Math.round(numeric);
      } else {
        row[meta.label] = Number(numeric.toFixed(2));
      }
    }
  });

    return row;
  });

  const primarySeries = activeSeries.filter((meta) => meta.kind !== "percentage");
  const percentageSeries = activeSeries.filter((meta) => meta.kind === "percentage");

  if (!primarySeries.length && !percentageSeries.length) {
    return undefined;
  }

  let type: RawMetricsChart["type"];
  let yKeys: string[];
  let secondaryKeys: string[] | undefined;

  if (primarySeries.length && percentageSeries.length) {
    type = "combo";
    yKeys = primarySeries.map((meta) => meta.label);
    secondaryKeys = percentageSeries.map((meta) => meta.label);
  } else if (primarySeries.length > 1) {
    type = "bar";
    yKeys = primarySeries.map((meta) => meta.label);
  } else if (primarySeries.length === 1) {
    type = "bar";
    yKeys = [primarySeries[0].label];
  } else {
    type = "line";
    yKeys = percentageSeries.map((meta) => meta.label);
  }

  if (!yKeys.length) {
    return undefined;
  }

  return {
    title: breakdown.label,
    type,
    data,
    x: "breakdown",
    y: yKeys,
    secondary_y: secondaryKeys,
  };
};

const aggregateTrendBuckets = (rows: Record<string, unknown>[]): TrendBuckets => {
  const daily = new Map<number, AggregatedTrendStats>();
  const weekday = new Map<number, AggregatedTrendStats>();
  const hour = new Map<number, AggregatedTrendStats>();

  const dailyFormatter = new Intl.DateTimeFormat("ar-SA", { month: "short", day: "numeric" });
  const weekdayFormatter = new Intl.DateTimeFormat("ar-SA", { weekday: "long" });

  const getNumber = (record: Record<string, unknown>, candidates: string[]): number => {
    for (const candidate of candidates) {
      const numeric = toNumber(record[candidate]);
      if (numeric !== undefined) {
        return numeric;
      }
    }
    return 0;
  };

  rows.forEach((row) => {
    const record = row as Record<string, unknown>;
    const date = ensureDate(
      record.order_date ?? record.ORDER_DATE ?? record.orderDate ?? record["Order Date"] ?? record["ORDER DATE"],
    );
    if (!date) {
      return;
    }

    const amount = getNumber(record, ["amount", "AMOUNT", "order_amount", "ORDER_AMOUNT", "Shipment_Value", "SHIPMENT_VALUE"]);
    const cod = getNumber(record, ["cod_amount", "COD_AMOUNT", "codTotal", "COD_TOTAL"]);

    const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayStats =
      daily.get(dayKey) ?? {
        key: dayKey,
        label: dailyFormatter.format(date),
        orders: 0,
        amount: 0,
        cod: 0,
      };
    dayStats.orders += 1;
    dayStats.amount += amount;
    dayStats.cod += cod;
    daily.set(dayKey, dayStats);

    const weekdayKey = date.getDay();
    const weekdayStats =
      weekday.get(weekdayKey) ?? {
        key: weekdayKey,
        label: weekdayFormatter.format(date),
        orders: 0,
        amount: 0,
        cod: 0,
      };
    weekdayStats.orders += 1;
    weekdayStats.amount += amount;
    weekdayStats.cod += cod;
    weekday.set(weekdayKey, weekdayStats);

    const hourKey = date.getHours();
    const hourStats =
      hour.get(hourKey) ?? {
        key: hourKey,
        label: `${hourKey.toString().padStart(2, "0")}:00`,
        orders: 0,
        amount: 0,
        cod: 0,
      };
    hourStats.orders += 1;
    hourStats.amount += amount;
    hourStats.cod += cod;
    hour.set(hourKey, hourStats);
  });

  const sortNumeric = (a: AggregatedTrendStats, b: AggregatedTrendStats) => a.key - b.key;

  return {
    daily: Array.from(daily.values()).sort(sortNumeric),
    weekday: Array.from(weekday.values()).sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a.key) - WEEKDAY_ORDER.indexOf(b.key),
    ),
    hour: Array.from(hour.values()).sort(sortNumeric),
  };
};

const buildTrendChart = (
  stats: AggregatedTrendStats[],
  chartType: RawMetricsChart["type"],
  xKey: string,
): RawMetricsChart | undefined => {
  if (!stats.length) {
    return undefined;
  }

  const includeAmount = stats.some((item) => item.amount > 0);
  const includeCod = stats.some((item) => item.cod > 0);

  const data = stats.map((item) => {
    const row: Record<string, number | string> = {
      [xKey]: item.label,
      الطلبات: item.orders,
    };
    if (includeAmount) {
      row["قيمة الطلبات"] = Number(item.amount.toFixed(2));
    }
    if (includeCod) {
      row["تحصيل COD"] = Number(item.cod.toFixed(2));
    }
    return row;
  });

  const yKeys = ["الطلبات"];
  if (includeAmount) {
    yKeys.push("قيمة الطلبات");
  }
  if (includeCod) {
    yKeys.push("تحصيل COD");
  }

  return {
    type: chartType,
    data,
    x: xKey,
    y: yKeys,
  };
};

const buildTrendFallback = (dataset: Record<string, unknown>[]): RawMetricsTrends => {
  if (!dataset.length) {
    return {};
  }

  const buckets = aggregateTrendBuckets(dataset);

  return {
    daily: buildTrendChart(buckets.daily, "line", "اليوم"),
    weekday: buildTrendChart(buckets.weekday, "bar", "اليوم"),
    hour_of_day: buildTrendChart(buckets.hour, "line", "الساعة"),
  };
};

const buildBreakdownFallbackMap = (breakdowns: RawMetricsBreakdown[]) => {
  return breakdowns.reduce<Map<string, RawMetricsChart>>((accumulator, breakdown, index) => {
    const chart = buildBreakdownChart(breakdown);
    if (chart) {
      const key = breakdown.dimension ?? breakdown.label ?? `breakdown-${index}`;
      accumulator.set(key, chart);
    }
    return accumulator;
  }, new Map<string, RawMetricsChart>());
};

type RawMetricsSummary = {
  run: string;
  fallback_used: boolean;
  totals: {
    orders: number;
    orders_cod: number;
    orders_cod_share_pct?: number | null;
    orders_non_cod: number;
    amount_total?: number | null;
    cod_total?: number | null;
    cod_average?: number | null;
    cod_min?: number | null;
    cod_max?: number | null;
  };
  breakdowns: RawMetricsBreakdown[];
  trends?: RawMetricsTrends;
  order_date_range?: { min?: string; max?: string };
};

const integerFormatter = new Intl.NumberFormat('en-US');
const decimalFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type RawChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const parseFormula = (formula?: string): { aggregator: string; column: string | null } => {
  if (!formula) return { aggregator: 'SUM', column: null };
  const match = formula.match(/([\w]+)\s*\(\s*([^)]+)\s*\)/i);
  if (!match) {
    return { aggregator: 'SUM', column: formula };
  }
  return { aggregator: match[1].toUpperCase(), column: match[2] };
};

const aggregateValues = (values: number[], aggregator: string) => {
  if (!values.length) return 0;
  switch (aggregator) {
    case 'AVG':
    case 'MEAN':
      return values.reduce((acc, val) => acc + val, 0) / values.length;
    case 'MAX':
      return Math.max(...values);
    case 'MIN':
      return Math.min(...values);
    default:
      return values.reduce((acc, val) => acc + val, 0);
  }
};

const computeMetricSummary = (rows: Record<string, unknown>[], metric: MetricSpec, timeColumn?: string | null) => {
  const { aggregator, column } = parseFormula(metric.formula);
  if (!column) {
    return { value: 0, spark: [] as number[] };
  }

  const joinKeys = Array.isArray(metric.join_keys) ? metric.join_keys : [];
  const seen = new Set<string>();
  const numericSeries = rows
    .map((row) => {
      const value = Number(row[column]);
      if (!Number.isFinite(value)) {
        return null;
      }
      const timestamp = timeColumn ? (row[timeColumn] !== undefined ? String(row[timeColumn]) : undefined) : undefined;
      const dedupKeyParts = joinKeys
        .map((key) => (row[key] !== undefined && row[key] !== null ? String(row[key]) : ""))
        .filter(Boolean);
      if (timestamp) {
        dedupKeyParts.push(timestamp);
      }
      const dedupKey = dedupKeyParts.length ? dedupKeyParts.join("||") : undefined;
      if (dedupKey && seen.has(dedupKey)) {
        return null;
      }
      if (dedupKey) {
        seen.add(dedupKey);
      }
      return { value, timestamp };
    })
    .filter((entry): entry is { value: number; timestamp?: string } => entry !== null);

  const value = aggregateValues(
    numericSeries.map((entry) => entry.value),
    aggregator,
  );

  const groupedByTime = new Map<string, number[]>();
  numericSeries.forEach((entry) => {
    if (!entry.timestamp) return;
    const existing = groupedByTime.get(entry.timestamp) ?? [];
    groupedByTime.set(entry.timestamp, [...existing, entry.value]);
  });

  const spark = Array.from(groupedByTime.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, values]) => aggregateValues(values, aggregator))
    .slice(-12);

  return { value, spark };
};

const buildDimensionSeries = (
  rows: Record<string, unknown>[],
  column: string,
  dimension: string,
  aggregator: string,
) => {
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    const dimValue = row[dimension];
    const raw = Number(row[column]);
    if (!Number.isFinite(raw) || dimValue === undefined || dimValue === null) return;
    const key = String(dimValue);
    groups.set(key, [...(groups.get(key) ?? []), raw]);
  });
  const entries = Array.from(groups.entries()).map(([key, values]) => ({
    label: key,
    value: aggregateValues(values, aggregator),
  }));
  const total = entries.reduce((acc, entry) => acc + entry.value, 0);
  return entries
    .map((entry) => ({
      dimension: entry.label,
      value: entry.value,
      share: total ? entry.value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
};

const buildTimeSeries = (rows: Record<string, unknown>[], column: string, timeColumn: string, aggregator: string) => {
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    const time = row[timeColumn];
    const raw = Number(row[column]);
    if (!Number.isFinite(raw) || time === undefined || time === null) return;
    const key = String(time);
    groups.set(key, [...(groups.get(key) ?? []), raw]);
  });
  return Array.from(groups.entries())
    .map(([key, values]) => ({
      [timeColumn]: key,
      value: aggregateValues(values, aggregator),
    }))
    .sort((a, b) => String(a[timeColumn]).localeCompare(String(b[timeColumn])));
};

const buildTabs = (metrics: MetricSpec[], categorical: string[]): TabConfig[] => {
  const uniqueDims = Array.from(new Set(categorical.filter(Boolean)));
  const tabs: TabConfig[] = [];

  const timeMetric = metrics.find((metric) => metric.time_col);
  if (timeMetric) {
    tabs.push({ id: 'time', label: 'Time', metricId: timeMetric.id, chartType: 'line' });
  }

  uniqueDims.slice(0, 4).forEach((dimension, index) => {
    const metric = metrics[(index + 1) % Math.max(metrics.length, 1)];
    tabs.push({
      id: `dimension-${index}`,
      label: dimension,
      dimension,
      metricId: metric?.id,
      chartType: index % 2 === 0 ? 'bar' : 'treemap',
    });
  });

  if (!tabs.length && metrics.length) {
    tabs.push({ id: 'metric-default', label: metrics[0].title ?? metrics[0].id, metricId: metrics[0].id, chartType: 'area' });
  }

  tabs.push({ id: 'narrative', label: 'Narrative' });
  return tabs;
};

const StoryBIContent: React.FC = () => {
  const metrics = useBiMetrics();
  const dimensions = useBiDimensions();
  const dataset = useFilteredDataset();
  const { setFilter } = useBiData();
  const { insights } = useBiInsights();

  const categoricalNames = useMemo(
    () => dimensions.categorical.map((item) => item.name).filter(Boolean),
    [dimensions],
  );

  const tabs = useMemo(() => buildTabs(metrics, categoricalNames), [metrics, categoricalNames]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id ?? 'narrative');
  const [selectedKpi, setSelectedKpi] = useState<string | null>(tabs[0]?.metricId ?? metrics[0]?.id ?? null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [canvasNarrative, setCanvasNarrative] = useState('Select a KPI or ask a question to start the story.');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! Choose a KPI card, open an insight, or ask for a breakdown.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [firstChartLogged, setFirstChartLogged] = useState(false);
  const [rawMetrics, setRawMetrics] = useState<RawMetricsSummary | null>(null);
  const [rawMetricsLoading, setRawMetricsLoading] = useState<boolean>(true);
  const [rawMetricsError, setRawMetricsError] = useState<string | null>(null);
  const [rawLlmMessages, setRawLlmMessages] = useState<RawChatMessage[]>([
    { role: 'assistant', content: 'أهلاً! أنا مساعد الأرقام الخام. اسألني عن هذه المؤشرات كما هي في الشيت الأصلي.' },
  ]);
  const [rawLlmInput, setRawLlmInput] = useState('');
  const [rawLlmLoading, setRawLlmLoading] = useState(false);
  const [rawLlmError, setRawLlmError] = useState<string | null>(null);
  const breakdowns = rawMetrics?.breakdowns ?? [];
  const trends = rawMetrics?.trends;
  const fallbackBreakdownCharts = useMemo(() => buildBreakdownFallbackMap(breakdowns), [breakdowns]);
  const fallbackTrends = useMemo(() => buildTrendFallback(dataset as Record<string, unknown>[]), [dataset]);
  const dailyTrendChart = hasChartData(trends?.daily) ? trends!.daily : fallbackTrends.daily;
  const weekdayTrendChart = hasChartData(trends?.weekday) ? trends!.weekday : fallbackTrends.weekday;
  const hourTrendChart = hasChartData(trends?.hour_of_day) ? trends!.hour_of_day : fallbackTrends.hour_of_day;
  if (process.env.NODE_ENV === "development") {
    console.groupCollapsed("[story-bi] trend sources");
    console.info("dataset rows:", dataset.length);
    console.info("raw trend daily valid:", hasChartData(trends?.daily), "fallback entries:", fallbackTrends.daily?.data?.length ?? 0, "sample:", fallbackTrends.daily?.data?.slice(0, 3));
    console.info("raw trend weekday valid:", hasChartData(trends?.weekday), "fallback entries:", fallbackTrends.weekday?.data?.length ?? 0, "sample:", fallbackTrends.weekday?.data?.slice(0, 3));
    console.info("raw trend hour valid:", hasChartData(trends?.hour_of_day), "fallback entries:", fallbackTrends.hour_of_day?.data?.length ?? 0, "sample:", fallbackTrends.hour_of_day?.data?.slice(0, 3));
    console.groupEnd();
  }
  const hasAnyTrendChart = Boolean(dailyTrendChart || weekdayTrendChart || hourTrendChart);
  const formatInteger = (value?: number | null) => {
    if (value === null || value === undefined) return '-';
    return integerFormatter.format(value);
  };

  const formatDecimal = (value?: number | null) => {
    if (value === null || value === undefined) return '-';
    return decimalFormatter.format(value);
  };

  const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${percentFormatter.format(value)}%`;
  };

  const formatCurrency = (value?: number | null) => {
    const formatted = formatDecimal(value);
    return formatted === '-' ? '—' : `${formatted} SAR`;
  };

  const computeBreakdownColumns = (values: RawMetricsBreakdownValue[]) => {
    const columns: { key: keyof RawMetricsBreakdownValue; label: string; render: (value: RawMetricsBreakdownValue[keyof RawMetricsBreakdownValue]) => string }[] =
      [
        { key: 'orders', label: 'الطلبات', render: (value) => formatInteger(value as number | null) },
        { key: 'share_pct', label: 'الحصة%', render: (value) => formatPercent(value as number | null) },
        { key: 'delivered', label: 'تم التسليم', render: (value) => formatInteger(value as number | null) },
        { key: 'out_for_delivery', label: 'قيد التسليم', render: (value) => formatInteger(value as number | null) },
        { key: 'returned', label: 'مرتجع', render: (value) => formatInteger(value as number | null) },
        { key: 'cod_total', label: 'تحصيل COD', render: (value) => formatCurrency(value as number | null) },
      ];

    return columns.filter((column) =>
      values.some((entry) => {
        const raw = entry[column.key];
        if (raw === null || raw === undefined) {
          return false;
        }
        if (typeof raw === 'number') {
          return raw !== 0;
        }
        return true;
      }),
    );
  };

  useEffect(() => {
    if (typeof performance !== 'undefined') {
      console.info('[story-bi] first paint (ms):', performance.now().toFixed(2));
    }
  }, []);

  useEffect(() => {
    if (!tabs.find((tab) => tab.id === activeTab) && tabs[0]) {
      setActiveTab(tabs[0].id);
      setSelectedKpi(tabs[0].metricId ?? metrics[0]?.id ?? null);
    }
  }, [tabs, activeTab, metrics]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadRawMetrics = async () => {
      try {
        setRawMetricsLoading(true);
        setRawMetricsError(null);
        const response = await fetch(`/api/bi/metrics/raw?run=run-latest&top=6`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load raw metrics: ${response.status}`);
        }
        const data = (await response.json()) as RawMetricsSummary;
        if (isMounted) {
          setRawMetrics(data);
        }
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        console.error('[story-bi] failed to load raw metrics', error);
        setRawMetricsError(error instanceof Error ? error.message : 'تعذّر تحميل الإحصاءات الخام.');
        setRawMetrics(null);
      } finally {
        if (isMounted) {
          setRawMetricsLoading(false);
        }
      }
    };

    loadRawMetrics();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const activeConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const metricId = selectedKpi ?? activeConfig?.metricId ?? metrics[0]?.id ?? null;
  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0];
  const { aggregator, column } = parseFormula(metric?.formula);
  const timeColumn = metric?.time_col ?? dimensions.date[0]?.name ?? null;

  const metricSummaries = useMemo(
    () =>
      metrics.map((item) => {
        const summary = computeMetricSummary(dataset, item, item.time_col ?? timeColumn);
        return { metric: item, ...summary };
      }),
    [metrics, dataset, timeColumn],
  );

  const dimensionSeries = useMemo(() => {
    if (!column || !activeConfig?.dimension) return [];
    return buildDimensionSeries(dataset, column, activeConfig.dimension, aggregator);
  }, [dataset, column, activeConfig, aggregator]);

  const timeSeries = useMemo(() => {
    if (!column || !timeColumn) return [];
    return buildTimeSeries(dataset, column, timeColumn, aggregator);
  }, [dataset, column, timeColumn, aggregator]);

  useEffect(() => {
    if (!firstChartLogged && (dimensionSeries.length || timeSeries.length)) {
      if (typeof performance !== 'undefined') {
        console.info('[story-bi] first chart (ms):', performance.now().toFixed(2));
      }
      setFirstChartLogged(true);
    }
  }, [dimensionSeries, timeSeries, firstChartLogged]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__storyBiDebug = () => ({
        datasetLength: dataset.length,
        sampleRow: dataset[0],
        fallbackTrendDaily: fallbackTrends.daily,
        fallbackTrendWeekday: fallbackTrends.weekday,
        fallbackTrendHour: fallbackTrends.hour_of_day,
        resolvedTrendDaily: dailyTrendChart,
        resolvedTrendWeekday: weekdayTrendChart,
        resolvedTrendHour: hourTrendChart,
        fallbackBreakdownCharts: Array.from(fallbackBreakdownCharts.entries()).map(([key, value]) => ({
          key,
          rows: value?.data?.length ?? 0,
          sample: value?.data?.slice(0, 5),
        })),
      });
    }
  }, [dataset, fallbackTrends, dailyTrendChart, weekdayTrendChart, hourTrendChart, fallbackBreakdownCharts]);

  const handleCardSelect = (metricIdValue: string) => {
    setSelectedKpi(metricIdValue);
    setSidePanelOpen(true);
    setCanvasNarrative(`Inspecting ${metricIdValue} in detail.`);
    if (typeof performance !== 'undefined') {
      console.info('[story-bi] sidepanel open (ms):', performance.now().toFixed(2), '| metric:', metricIdValue);
    }
  };

  const handleTabSelect = (tab: TabConfig) => {
    setActiveTab(tab.id);
    if (tab.metricId) {
      setSelectedKpi(tab.metricId);
    }
    if (tab.dimension) {
      setCanvasNarrative(`Highlighting ${tab.metricId ?? metricId ?? ''} by ${tab.dimension}.`);
    } else if (tab.id === 'narrative') {
      setCanvasNarrative('Narrative feed applies curated insights from Phase 08-10 outputs.');
    } else {
      setCanvasNarrative(`Showing ${tab.metricId ?? metricId ?? ''}.`);
    }
  };

  const applyInsight = (insight: Insight) => {
    if (insight.drivers?.length) {
      insight.drivers.forEach((driver) => {
        if (driver.dimension && driver.value) {
          setFilter(driver.dimension, [String(driver.value)]);
        }
      });
      setCanvasNarrative(`Filters applied from insight "${insight.title}".`);
    } else {
      setCanvasNarrative(`Insight "${insight.title}" opened.`);
    }
    if (insight.kpi) {
      setSelectedKpi(insight.kpi);
      setSidePanelOpen(true);
    }
    setActiveTab('narrative');
  };

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = chatInput.trim();
    if (!query) return;

    const lower = query.toLowerCase();
    const matchingMetric =
      metrics.find(
        (item) =>
          lower.includes(item.id.toLowerCase()) ||
          (item.title && lower.includes(item.title.toLowerCase())),
      ) ?? null;
    const matchingDimension =
      categoricalNames.find((name) => lower.includes(name.toLowerCase())) ?? null;

    let assistantMessage = '';

    if (matchingMetric) {
      setSelectedKpi(matchingMetric.id);
      assistantMessage = `Focused on metric ${matchingMetric.title ?? matchingMetric.id}.`;
    }

    if (matchingDimension) {
      setActiveTab(tabs.find((tab) => tab.dimension === matchingDimension)?.id ?? activeTab);
      assistantMessage = `Exploring ${matchingMetric?.title ?? matchingMetric?.id ?? metricId ?? 'metric'} by ${matchingDimension}.`;
    } else if (matchingMetric && !assistantMessage.includes('Exploring')) {
      assistantMessage = `Exploring ${matchingMetric.title ?? matchingMetric.id}. Try mentioning a dimension for a breakdown.`;
    }

    if (!matchingMetric && !matchingDimension) {
      const metricHints = metrics.map((item) => item.id).slice(0, 5).join(', ') || 'none detected';
      const dimensionHints = categoricalNames.slice(0, 5).join(', ') || 'no categorical columns detected';
      assistantMessage = `Metric or dimension not available. Try these metrics: ${metricHints}. Dimensions: ${dimensionHints}.`;
    }

    setCanvasNarrative(assistantMessage || 'Canvas updated.');
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', content: query },
      { role: 'assistant', content: assistantMessage || 'Canvas updated.' },
    ]);
    setChatInput('');
  };

  const handleRawLlmSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = rawLlmInput.trim();
    if (!question) return;

    const payload = {
      run: rawMetrics?.run ?? 'run-latest',
      top: 6,
      question,
      history: rawLlmMessages
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content })),
    };

    setRawLlmLoading(true);
    setRawLlmError(null);
    setRawLlmMessages((prev) => [...prev, { role: 'user', content: question }]);
    setRawLlmInput('');

    try {
      const response = await fetch('/api/bi/metrics/raw/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`LLM request failed (${response.status})`);
      }
      const data = await response.json();
      const replyPayload = data?.reply;
      let replyText = '';
      if (typeof replyPayload === 'string') {
        replyText = replyPayload;
      } else if (replyPayload && typeof replyPayload === 'object') {
        replyText = String(replyPayload.reply ?? replyPayload.summary ?? JSON.stringify(replyPayload));
      } else {
        replyText = 'لا توجد إجابة مفهومة.';
      }
      setRawLlmMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
    } catch (error) {
      console.error('[story-bi] raw metrics LLM failed', error);
      setRawLlmError(error instanceof Error ? error.message : 'حدث خطأ أثناء التواصل مع نموذج الذكاء الاصطناعي.');
      setRawLlmMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'تعذر توليد إجابة في الوقت الحالي. حاول مجددًا لاحقًا.',
        },
      ]);
    } finally {
      setRawLlmLoading(false);
    }
  };

  const canvasData =
    activeConfig?.chartType === 'line' && timeColumn
      ? timeSeries
      : activeConfig?.dimension
      ? dimensionSeries.map((entry) => ({
          [activeConfig.dimension ?? 'dimension']: entry.dimension,
          value: entry.value,
          share: entry.share,
        }))
      : timeSeries;

  const canvasXAxis =
    activeConfig?.chartType === 'line' && timeColumn
      ? timeColumn
      : activeConfig?.dimension ?? timeColumn ?? 'label';

  const renderNarrative = () => (
    <NarrativeFeed
      onOpen={(insight) => {
        applyInsight(insight);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-6 pb-32" dir="rtl">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-start">Story-driven BI</h1>
        <p className="text-sm text-muted-foreground text-start">
          Built from Phase 08 insights, Phase 09 validation, and Phase 10 marts. Columns are discovered at runtime; no hardcoded schema.
        </p>
      </header>

            {rawMetricsLoading ? (
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground shadow-sm">
          جارٍ تحميل الإحصاءات الخام...
        </div>
      ) : rawMetricsError ? (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive-foreground shadow-sm">
          تعذّر تحميل الإحصاءات الخام: {rawMetricsError}
        </div>
      ) : rawMetrics ? (
        <section className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/40 bg-background/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">عدد الطلبات (RAW)</CardTitle>
                <CardDescription>الأعداد مباشرة قبل أي معالجة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold text-foreground">{formatInteger(rawMetrics.totals.orders)}</p>
                <p className="text-xs text-muted-foreground">
                  COD: {formatInteger(rawMetrics.totals.orders_cod)}
                  {formatPercent(rawMetrics.totals.orders_cod_share_pct) !== '—' ? (
                    <span> ({formatPercent(rawMetrics.totals.orders_cod_share_pct)})</span>
                  ) : null}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">تحصيل COD الخام</CardTitle>
                <CardDescription>الإجمالي والمتوسط من الشيت الأصلي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(rawMetrics.totals.cod_total)}</p>
                <p className="text-xs text-muted-foreground">متوسط التذكرة: {formatCurrency(rawMetrics.totals.cod_average)}</p>
                <p className="text-xs text-muted-foreground">
                  نطاق القيم: {formatCurrency(rawMetrics.totals.cod_min)} – {formatCurrency(rawMetrics.totals.cod_max)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">القيمة الإجمالية الملتقطة</CardTitle>
                <CardDescription>يشمل جميع طرق الدفع قبل أي معالجة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(rawMetrics.totals.amount_total)}</p>
                <p className="text-xs text-muted-foreground">الطلبات غير COD: {formatInteger(rawMetrics.totals.orders_non_cod)}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">نطاق البيانات الخام</CardTitle>
                <CardDescription>يمثل ما بين أول وآخر تاريخ في الشيت</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">من:</span>{' '}
                  {rawMetrics.order_date_range?.min ?? 'غير متاح'}
                </div>
                <div>
                  <span className="font-semibold text-foreground">إلى:</span>{' '}
                  {rawMetrics.order_date_range?.max ?? 'غير متاح'}
                </div>
                <div className="text-xs">
                  Run: <span className="font-mono text-foreground">{rawMetrics.run}</span>
                  {rawMetrics.fallback_used ? <span className="ml-2 text-destructive">(استخدم مصدر بديل)</span> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {hasAnyTrendChart ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {dailyTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">الطلبات حسب اليوم</h3>
                  <ChartContainer
                    type={dailyTrendChart.type}
                    data={dailyTrendChart.data}
                    x={dailyTrendChart.x}
                    y={dailyTrendChart.y}
                    secondaryY={dailyTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات يومية."
                  />
                </div>
              ) : null}
              {weekdayTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">التوزيع حسب أيام الأسبوع</h3>
                  <ChartContainer
                    type={weekdayTrendChart.type}
                    data={weekdayTrendChart.data}
                    x={weekdayTrendChart.x}
                    y={weekdayTrendChart.y}
                    secondaryY={weekdayTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات أسبوعية."
                  />
                </div>
              ) : null}
              {hourTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">الطلبات حسب الساعة</h3>
                  <ChartContainer
                    type={hourTrendChart.type}
                    data={hourTrendChart.data}
                    x={hourTrendChart.x}
                    y={hourTrendChart.y}
                    secondaryY={hourTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات زمنية."
                  />
                </div>
              ) : null}
            </div>
          ) : null}\n{breakdowns.length ? (
            <div className="flex flex-col gap-4">
              {breakdowns.map((breakdown, index) => {
                const columns = computeBreakdownColumns(breakdown.values);
                const breakdownKey = breakdown.dimension ?? breakdown.label ?? `breakdown-${index}`;
                const resolvedBreakdownChart = hasChartData(breakdown.chart)
                  ? breakdown.chart
                  : fallbackBreakdownCharts.get(breakdownKey);
                if (process.env.NODE_ENV === "development") {
                  console.groupCollapsed("[story-bi] breakdown chart", breakdownKey);
                  console.info("raw chart valid:", hasChartData(breakdown.chart), "fallback rows:", resolvedBreakdownChart?.data?.length ?? 0);
                  console.info("fallback sample:", resolvedBreakdownChart?.data?.slice(0, 5));
                  console.info("columns detected:", columns.map((column) => column.label));
                  console.groupEnd();
                }
                return (
                  <Card key={breakdownKey} className="border-border/40 bg-background/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold text-foreground">{breakdown.label}</CardTitle>
                      <CardDescription>أبرز القيم المتكررة ومؤشراتها الرئيسية</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {resolvedBreakdownChart ? (
                        <ChartContainer
                          type={resolvedBreakdownChart.type}
                          data={resolvedBreakdownChart.data}
                          x={resolvedBreakdownChart.x}
                          y={resolvedBreakdownChart.y}
                          secondaryY={resolvedBreakdownChart.secondary_y}
                          emptyMessage="لا توجد بيانات كافية للرسم."
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/40 p-6 text-sm text-muted-foreground">
                          لا توجد بيانات كافية للرسم.
                        </div>
                      )}
                      <div className="overflow-hidden rounded-xl border border-border/40">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30 text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-start">القيمة</th>
                              {columns.map((column) => (
                                <th key={column.key} className="px-3 py-2 text-start">
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.values.map((value) => (
                              <tr key={value.value} className="border-t border-border/30">
                                <td className="px-3 py-2 text-start font-medium text-foreground">{value.value}</td>
                                {columns.map((column) => (
                                  <td key={`${value.value}-${column.key}`} className="px-3 py-2 text-start">
                                    {column.render(value[column.key])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
              لا توجد أبعاد قابلة للتحليل في هذا الشيت.
            </div>
          )}

          <Card className="border-border/40 bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">مساعد الأرقام الخام (LLM)</CardTitle>
              <CardDescription>يجيب فقط عن الأسئلة المتعلقة بالمؤشرات أعلاه.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rawLlmError ? (
                <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                  {rawLlmError}
                </div>
              ) : null}
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/10 p-3 text-xs">
                {rawLlmMessages.map((message, index) => (
                  <div key={`raw-llm-${index}`} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <span
                      className={`inline-flex max-w-[75%] rounded-2xl px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
                      }`}
                    >
                      {message.content}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleRawLlmSubmit} className="space-y-2">
                <textarea
                  value={rawLlmInput}
                  onChange={(event) => setRawLlmInput(event.target.value)}
                  placeholder="اكتب سؤالك حول الأرقام الخام..."
                  className="h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    هذا المساعد متخصص في هذه المرحلة فقط. للاستفسار عن مراحل أخرى استخدم الأقسام اللاحقة.
                  </p>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    disabled={rawLlmLoading}
                  >
                    {rawLlmLoading ? 'جارٍ المعالجة...' : 'إرسال'}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <FilterBar />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricSummaries.map((summary) => {
          const hasTime = (metrics.find((item) => item.id === summary.metric.id)?.time_col ?? null) !== null;
          const previous = summary.spark.at(-2);
          const latest = summary.spark.at(-1);
          const wowDelta =
            hasTime && previous !== undefined && latest !== undefined && Number.isFinite(previous) && Number.isFinite(latest)
              ? ((latest - previous) / Math.max(Math.abs(previous), 1)) * 100
              : null;
          return (
            <KpiCard
              key={summary.metric.id}
              title={summary.metric.title ?? summary.metric.id}
              value={summary.value}
              delta={wowDelta}
              deltaLabel="WoW"
              trendSpark={hasTime ? summary.spark : undefined}
              onClick={() => handleCardSelect(summary.metric.id)}
              active={selectedKpi === summary.metric.id}
            />
          );
        })}
      </section>

      <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/70 p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabSelect(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-start">Insight Canvas</h2>
          {activeTab === 'narrative' ? (
            renderNarrative()
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-start">{canvasNarrative}</p>
              {activeConfig?.chartType && column ? (
                <ChartContainer
                  type={activeConfig.chartType}
                  data={canvasData}
                  x={canvasXAxis}
                  y={activeConfig.chartType === 'combo' ? ['value'] : 'value'}
                  secondaryY={activeConfig.chartType === 'combo' ? 'share' : undefined}
                  emptyMessage="No data available for the selected combination."
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No sufficient data to visualise this request.
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-start">Latest Narrative</h2>
          {renderNarrative()}
        </div>
      </section>

      <form
        onSubmit={handleChatSubmit}
        className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-lg backdrop-blur"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Docked Chat</span>
          <span className="text-xs text-muted-foreground">Powered by local metrics &amp; dimensions.</span>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/30 bg-muted/10 p-3 text-sm">
          {chatHistory.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <span
                className={`inline-flex max-w-[75%] rounded-2xl px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {message.content}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask for a metric or dimension..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Send
          </button>
        </div>
      </form>

      <SidePanel kpiId={selectedKpi} open={sidePanelOpen} onClose={() => setSidePanelOpen(false)} />
    </div>
  );
};

export const StoryBIPage: React.FC = () => {
  return (
    <BiDataProvider>
      <StoryBIContent />
    </BiDataProvider>
  );
};

export default StoryBIPage;



