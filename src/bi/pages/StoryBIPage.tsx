'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTrigger } from '@/components/help/help-trigger';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  CorrelationListCard,
  FilterBar,
  Layer2InsightsPanel,
  Layer3IntelligencePanel,
  KnimeResultsPanel,
  NarrativeFeed,
  SidePanel,
  correlationPairKey,
} from '../components';
import { Layer1Chart, Layer1KpiCard } from '../charts/layer1';
import {
  BiDataProvider,
  useBiData,
  useBiDimensions,
  useFilteredDataset,
  useBiInsights,
  useBiMetrics,
  useBiCorrelations,
} from '../data';
import type {
  CorrelationCollection,
  CorrelationPair,
  Insight,
  Layer2AgentRecommendation,
  MetricSpec,
} from '../data';

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

type CorrelationExplanationPayload = {
  summary?: string;
  recommended_actions?: string[];
  confidence?: string | null;
  mode?: string | null;
  provider?: string | null;
  model?: string | null;
};

type CorrelationFilterState = {
  kpi: string;
  domain: string;
  direction: string;
  persistentOnly: boolean;
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

const DEFAULT_CORRELATION_FILTER: CorrelationFilterState = {
  kpi: "all",
  domain: "all",
  direction: "all",
  persistentOnly: false,
};

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
  artifacts_root?: string | null;
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
  correlations?: CorrelationCollection;
};

const integerFormatter = new Intl.NumberFormat('ar-SA');
const decimalFormatter = new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    tabs.push({ id: 'time', label: 'الزمن', metricId: timeMetric.id, chartType: 'line' });
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

  tabs.push({ id: 'narrative', label: 'السرد' });
  return tabs;
};


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
  return formatted === '-' ? '—' : `${formatted} ر.س`;
};

const StoryBIContent: React.FC = () => {
  const { translate, language } = useLanguage();
  const metrics = useBiMetrics();
  const dimensions = useBiDimensions();
  const dataset = useFilteredDataset();
  const { setFilter, intelligence, runLayer2Assistant } = useBiData();
  const { insights, insightStats } = useBiInsights();
  const correlations = useBiCorrelations();
  const activeRun = correlations.run ?? 'run-latest';

  const insightTypeLabel = (type: string) => {
    switch (type) {
      case 'anomaly':
        return translate('شذوذ');
      case 'trend':
        return translate('اتجاه');
      default:
        return translate(type);
    }
  };

  const formatStatCount = (value?: number) => (typeof value === 'number' ? integerFormatter.format(value) : '0');

  const categoricalNames = useMemo(
    () => dimensions.categorical.map((item) => item.name).filter(Boolean),
    [dimensions],
  );

  const tabs = useMemo(() => buildTabs(metrics, categoricalNames), [metrics, categoricalNames]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id ?? 'narrative');
  const [selectedKpi, setSelectedKpi] = useState<string | null>(tabs[0]?.metricId ?? metrics[0]?.id ?? null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [canvasNarrative, setCanvasNarrative] = useState('اختر مؤشراً أو اطرح سؤالاً لبدء السرد.');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'مرحباً! اختر بطاقة مؤشر، افتح إحدى الرؤى، أو اطلب تفصيلاً معيناً.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
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
  const breakdowns = useMemo(() => rawMetrics?.breakdowns ?? [], [rawMetrics]);
  const [correlationFilterState, setCorrelationFilterState] = useState<CorrelationFilterState>(DEFAULT_CORRELATION_FILTER);
  const [correlationExplanations, setCorrelationExplanations] = useState<Record<string, CorrelationExplanationPayload>>({});
  const [correlationExplainingKey, setCorrelationExplainingKey] = useState<string | null>(null);
  const [correlationError, setCorrelationError] = useState<string | null>(null);

  const determineDriverDomain = useCallback((item: CorrelationPair): string | null => {
    if (item.driver_domain) {
      return item.driver_domain;
    }
    if (item.kpi_feature) {
      if (item.kpi_feature === item.feature_a) {
        return item.feature_b_domain ?? item.feature_a_domain ?? null;
      }
      if (item.kpi_feature === item.feature_b) {
        return item.feature_a_domain ?? item.feature_b_domain ?? null;
      }
    }
    return item.feature_b_domain ?? item.feature_a_domain ?? null;
  }, []);

  const determineDirection = useCallback((item: CorrelationPair): "improves" | "worsens" | "neutral" => {
    if (item.effect_direction === "improves" || item.effect_direction === "worsens") {
      return item.effect_direction;
    }
    if (typeof item.correlation === "number") {
      if (item.correlation < 0) {
        return "worsens";
      }
      if (item.correlation > 0) {
        return "improves";
      }
    }
    return "neutral";
  }, []);

  const allCorrelationItems = useMemo(() => {
    const items: CorrelationPair[] = [];
    if (Array.isArray(correlations.numeric)) {
      items.push(...correlations.numeric);
    }
    if (Array.isArray(correlations.datetime)) {
      items.push(...correlations.datetime);
    }
    if (correlations.business) {
      if (Array.isArray(correlations.business.numeric_numeric)) {
        items.push(...correlations.business.numeric_numeric);
      }
      if (Array.isArray(correlations.business.numeric_categorical)) {
        items.push(...correlations.business.numeric_categorical);
      }
      if (Array.isArray(correlations.business.categorical_categorical)) {
        items.push(...correlations.business.categorical_categorical);
      }
    }
    return items;
  }, [correlations]);

  const correlationKpiOptions = useMemo(() => {
    const entries = new Map<string, string>();
    allCorrelationItems.forEach((item) => {
      const key = item.kpi_tag ?? item.kpi_label;
      if (!key) {
        return;
      }
      const label = item.kpi_label ?? key;
      entries.set(key, label);
    });
    return Array.from(entries.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [allCorrelationItems]);

  const correlationDomainOptions = useMemo(() => {
    const domains = new Set<string>();
    allCorrelationItems.forEach((item) => {
      const domain = determineDriverDomain(item);
      if (domain) {
        domains.add(domain);
      }
    });
    return Array.from(domains.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [allCorrelationItems, determineDriverDomain]);

  const directionOptions = useMemo(
    () => [
      { value: "all", label: "كل الاتجاهات" },
      { value: "improves", label: "يرتبط بتحسّن KPI" },
      { value: "worsens", label: "يرتبط بتدهور KPI" },
    ],
    [],
  );

  const isCorrelationFilterActive = useMemo(
    () =>
      correlationFilterState.kpi !== "all" ||
      correlationFilterState.domain !== "all" ||
      correlationFilterState.direction !== "all" ||
      correlationFilterState.persistentOnly,
    [correlationFilterState],
  );

  const handleCorrelationFilterChange = useCallback(
    (key: keyof CorrelationFilterState, value: string) => {
      setCorrelationFilterState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleCorrelationPersistenceToggle = useCallback((checked: boolean) => {
    setCorrelationFilterState((prev) => ({ ...prev, persistentOnly: checked }));
  }, []);

  const resetCorrelationFilters = useCallback(() => {
    setCorrelationFilterState(DEFAULT_CORRELATION_FILTER);
  }, []);

  const applyCorrelationFilters = useCallback(
    (items: CorrelationPair[]) =>
      items.filter((item) => {
        const kpiValue = item.kpi_tag ?? item.kpi_label ?? "";
        if (correlationFilterState.kpi !== "all" && kpiValue !== correlationFilterState.kpi) {
          return false;
        }
        const direction = determineDirection(item);
        if (correlationFilterState.direction !== "all" && direction !== correlationFilterState.direction) {
          return false;
        }
        if (correlationFilterState.persistentOnly && !item.is_persistent) {
          return false;
        }
        const domain = determineDriverDomain(item);
        if (correlationFilterState.domain !== "all" && domain !== correlationFilterState.domain) {
          return false;
        }
        return true;
      }),
    [correlationFilterState, determineDirection, determineDriverDomain],
  );

  const numericHighlights = useMemo(
    () => applyCorrelationFilters(correlations.numeric ?? []).slice(0, 6),
    [correlations.numeric, applyCorrelationFilters],
  );
  const datetimeHighlights = useMemo(
    () => applyCorrelationFilters(correlations.datetime ?? []).slice(0, 6),
    [correlations.datetime, applyCorrelationFilters],
  );
  const businessGroups = useMemo(
    () =>
      correlations.business ?? {
        numeric_numeric: [],
        numeric_categorical: [],
        categorical_categorical: [],
      },
    [correlations.business],
  );
  const businessNumericHighlights = useMemo(
    () => applyCorrelationFilters(businessGroups.numeric_numeric ?? []).slice(0, 6),
    [businessGroups.numeric_numeric, applyCorrelationFilters],
  );
  const businessNumericCategoricalHighlights = useMemo(
    () => applyCorrelationFilters(businessGroups.numeric_categorical ?? []).slice(0, 6),
    [businessGroups.numeric_categorical, applyCorrelationFilters],
  );
  const businessCategoricalHighlights = useMemo(
    () => applyCorrelationFilters(businessGroups.categorical_categorical ?? []).slice(0, 6),
    [businessGroups.categorical_categorical, applyCorrelationFilters],
  );

  const handleExplainCorrelation = useCallback(
    async (item: CorrelationPair) => {
      const key = correlationPairKey(item);
      setCorrelationError(null);
      setCorrelationExplainingKey(key);
      try {
        const response = await fetch('/api/bi/correlations/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            run: activeRun,
            feature_a: item.feature_a,
            feature_b: item.feature_b,
            kind: item.kind ?? 'numeric',
            language,
            use_llm: true,
          }),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Failed to generate explanation (${response.status})`);
        }
        const data = await response.json();
        const payload: CorrelationExplanationPayload = data?.explanation ?? {};
        setCorrelationExplanations((prev) => ({ ...prev, [key]: payload }));
      } catch (error) {
        console.error('[story-bi] correlation explain failed', error);
        setCorrelationError(error instanceof Error ? error.message : 'تعذر توليد الشرح');
      } finally {
        setCorrelationExplainingKey(null);
      }
    },
    [activeRun, language],
  );


  const biSummary = rawMetrics
    ? (() => {
        const summary: string[] = [];
        const ordersText = rawMetrics.totals?.orders != null ? formatInteger(rawMetrics.totals.orders) : translate("بانتظار البيانات");
        summary.push(
          translate("Orders processed: {value}", {
            value: ordersText,
          }),
        );

        const codShare = rawMetrics.totals?.orders_cod_share_pct != null
          ? formatPercent(rawMetrics.totals.orders_cod_share_pct)
          : translate("بانتظار البيانات");
        summary.push(
          translate("Cash-on-delivery share: {value}", {
            value: codShare,
          }),
        );

        const codCollected = rawMetrics.totals?.cod_total != null ? formatCurrency(rawMetrics.totals.cod_total) : translate("بانتظار البيانات");
        summary.push(
          translate("Total COD collected: {value}", {
            value: codCollected,
          }),
        );

        if (rawMetrics.order_date_range) {
          const coverageRange = `${rawMetrics.order_date_range.min ?? translate("بانتظار البيانات")} → ${rawMetrics.order_date_range.max ?? translate("بانتظار البيانات")}`;
          summary.push(
            translate("Data coverage: {range}", {
              range: coverageRange,
            }),
          );
        }

        if (breakdowns?.length) {
          const topBreakdown = breakdowns[0];
          const topValue = topBreakdown?.values?.[0];
          const label = topBreakdown?.label ?? translate("Not specified");
          const recordedOrders = toNumber(topValue?.orders);
          const formattedOrders = recordedOrders != null ? formatInteger(recordedOrders) : translate("بانتظار البيانات");
          summary.push(
            translate("Top breakdown {label} contributes {value} orders.", {
              label,
              value: formattedOrders,
            }),
          );
        }

        return summary;
      })()
    : null;
  const trends = rawMetrics?.trends;
  const rawCorrelationData: CorrelationCollection = rawMetrics?.correlations ?? correlations;
  const rawNumericHighlights = rawCorrelationData.numeric.slice(0, 4);
  const rawDatetimeHighlights = rawCorrelationData.datetime.slice(0, 4);
  const rawBusinessGroups = rawCorrelationData.business ?? {
    numeric_numeric: [],
    numeric_categorical: [],
    categorical_categorical: [],
  };
  const rawBusinessNumeric = rawBusinessGroups.numeric_numeric.slice(0, 4);
  const rawBusinessNumericCategorical = rawBusinessGroups.numeric_categorical.slice(0, 4);
  const rawBusinessCategorical = rawBusinessGroups.categorical_categorical.slice(0, 4);
const fallbackBreakdownCharts = useMemo(() => buildBreakdownFallbackMap(breakdowns), [breakdowns]);
  const fallbackTrends = useMemo(() => buildTrendFallback(dataset as Record<string, unknown>[]), [dataset]);
  const dailyTrendChart = hasChartData(trends?.daily) ? trends!.daily : fallbackTrends.daily;
  const weekdayTrendChart = hasChartData(trends?.weekday) ? trends!.weekday : fallbackTrends.weekday;
  const hourTrendChart = hasChartData(trends?.hour_of_day) ? trends!.hour_of_day : fallbackTrends.hour_of_day;
  
  const hasAnyTrendChart = Boolean(dailyTrendChart || weekdayTrendChart || hourTrendChart);
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
    setCanvasNarrative(`يتم التركيز على ${metricIdValue} بالتفصيل.`);
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
      setCanvasNarrative(`عرض ${tab.metricId ?? metricId ?? ''} بحسب ${tab.dimension}.`);
    } else if (tab.id === 'narrative') {
      setCanvasNarrative('تُعرض هنا الرؤى المُجهزة من مخرجات المراحل 08 إلى 10.');
    } else {
      setCanvasNarrative(`إظهار ${tab.metricId ?? metricId ?? ''} حالياً.`);
    }
  };

  const applyAssistantRecommendation = useCallback(
    (recommendation: Partial<Layer2AgentRecommendation> | undefined) => {
      if (!recommendation) return;

      if (recommendation.metricId) {
        setSelectedKpi(recommendation.metricId);
        setSidePanelOpen(true);
      }

      if (recommendation.dimension) {
        const dimensionLower = recommendation.dimension.toLowerCase();
        const tabMatch =
          tabs.find((tab) => tab.dimension && tab.dimension.toLowerCase() === dimensionLower) ?? null;
        if (tabMatch) {
          setActiveTab(tabMatch.id);
        }
      }

      if (recommendation.filters) {
        Object.entries(recommendation.filters).forEach(([dimension, values]) => {
          if (Array.isArray(values)) {
            const cleaned = values
              .map((value) => (typeof value === 'string' ? value.trim() : String(value).trim()))
              .filter(Boolean);
            setFilter(dimension, cleaned);
          }
        });
      }
    },
    [tabs, setFilter, setSelectedKpi, setSidePanelOpen, setActiveTab],
  );

  const buildFallbackAgentResponse = useCallback(
    (query: string): { message: string; recommendation: Partial<Layer2AgentRecommendation> } => {
      const lower = query.toLowerCase();
      const matchingMetric =
        metrics.find(
          (item) =>
            lower.includes(item.id.toLowerCase()) ||
            (!!item.title && lower.includes(item.title.toLowerCase())),
        ) ?? null;
      const matchingDimension =
        categoricalNames.find((name) => lower.includes(name.toLowerCase())) ?? null;

      let assistantMessage = '';

      if (matchingMetric) {
        assistantMessage = `تم التركيز على المؤشر ${matchingMetric.title ?? matchingMetric.id}.`;
      }

      if (matchingDimension) {
        assistantMessage = `يتم تحليل ${matchingMetric?.title ?? matchingMetric?.id ?? metricId ?? 'المؤشر'} بحسب ${matchingDimension}.`;
      } else if (matchingMetric && !assistantMessage.includes('يتم تحليل')) {
        assistantMessage = `يتم تحليل ${matchingMetric.title ?? matchingMetric.id}. جرّب ذكر بُعد للحصول على تفصيل أدق.`;
      }

      if (!matchingMetric && !matchingDimension) {
        const metricHints = metrics.map((item) => item.id).slice(0, 5).join('، ') || 'لا يوجد';
        const dimensionHints = categoricalNames.slice(0, 5).join('، ') || 'لا توجد أبعاد متاحة';
        assistantMessage = `تعذر العثور على المؤشر أو البُعد المطلوب. جرّب هذه المؤشرات: ${metricHints}. الأبعاد المقترحة: ${dimensionHints}.`;
      }

      return {
        message: assistantMessage || 'تم تحديث اللوحة.',
        recommendation: {
          metricId: matchingMetric?.id ?? undefined,
          metricLabel: matchingMetric?.title ?? matchingMetric?.id ?? null,
          dimension: matchingDimension ?? undefined,
          filters: {},
        },
      };
    },
    [metrics, categoricalNames, metricId],
  );

  const applyInsight = (insight: Insight) => {
    if (insight.drivers?.length) {
      insight.drivers.forEach((driver) => {
        if (driver.dimension && driver.value) {
          setFilter(driver.dimension, [String(driver.value)]);
        }
      });
      setCanvasNarrative(`تم تطبيق مرشحات من الرؤية "${insight.title}".`);
    } else {
      setCanvasNarrative(`تم فتح الرؤية "${insight.title}".`);
    }
    if (insight.kpi) {
      setSelectedKpi(insight.kpi);
      setSidePanelOpen(true);
    }
    setActiveTab('narrative');
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = chatInput.trim();
    if (!query || chatLoading) {
      return;
    }

    const userEntry: ChatMessage = { role: 'user', content: query };
    const historySnapshot = [...chatHistory, userEntry];
    setChatHistory(historySnapshot);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await runLayer2Assistant({
        question: query,
        history: historySnapshot.slice(-6),
      });
      const assistantReply = response.reply || 'تم تحديث اللوحة.';
      setChatHistory((prev) => [...prev, { role: 'assistant', content: assistantReply }]);
      setCanvasNarrative(assistantReply);
      applyAssistantRecommendation(response.recommendation);
    } catch (error) {
      console.warn('[story-bi] layer2 assistant fallback', error);
      const fallback = buildFallbackAgentResponse(query);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: fallback.message }]);
      setCanvasNarrative(fallback.message);
      applyAssistantRecommendation(fallback.recommendation);
    } finally {
      setChatLoading(false);
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-start">{translate("لوحة التحليلات السردية")}</h1>
          <HelpTrigger
            topicId="bi.overview"
            aria-label={translate("شرح مساحة العمل للذكاء البياني")}
            variant="link"
            buildTopic={() => {
              const orders = rawMetrics?.totals?.orders != null ? formatInteger(rawMetrics.totals.orders) : translate("بانتظار البيانات")
              const codShare = rawMetrics?.totals?.orders_cod_share_pct != null ? formatPercent(rawMetrics.totals.orders_cod_share_pct) : translate("بانتظار البيانات")
              const coverage = rawMetrics?.order_date_range
                ? `${rawMetrics.order_date_range.min ?? translate("بانتظار البيانات")} → ${rawMetrics.order_date_range.max ?? translate("بانتظار البيانات")}`
                : translate("بانتظار البيانات")
              return {
                title: translate("مساحة العمل السردية"),
                summary: translate(
                  "تجمع هذه الصفحة مؤشرات الأداء، والرؤى، والارتباطات الناتجة عن المراحل 08 إلى 10 في قصة تشغيلية واحدة.",
                ),
                detailItems: [
                  translate("الطلبات المعالجة: {value}", { value: orders }),
                  translate("حصة الدفع عند الاستلام: {value}", { value: codShare }),
                  translate("نطاق البيانات الزمنية: {range}", { range: coverage }),
                ],
                sources: [
                  {
                    label: translate("مخرجات المرحلة 08"),
                    description: translate("تحليل البيانات الاستكشافي الذي يكشف عن المحركات والع anomalies."),
                  },
                  {
                    label: translate("بوابة المرحلة 09"),
                    description: translate("نتائج التحقق التشغيلي وقياس الالتزام بمؤشرات SLA."),
                  },
                  {
                    label: translate("مخازن المرحلة 10"),
                    description: translate("المقاييس المعتمدة التي تغذي اللوحات والرسوم البيانية."),
                  },
                ],
                suggestedQuestions: [
                  translate("ما هو البُعد الذي يفسر تغير المؤشر الأخير؟"),
                  translate("أي الشذوذات يجب مناقشتها مع فريق العمليات؟"),
                ],
                onAsk: () => {
                  setActiveTab('narrative')
                  setSidePanelOpen(true)
                },
              }
            }}
          >
            {translate("شرح")}
          </HelpTrigger>
        </div>
        <p className="text-sm text-muted-foreground text-start">
          {translate("تعتمد اللوحة على رؤى المرحلة 08، والتحقق التشغيلي في المرحلة 09، وقواعد البيانات الدلالية في المرحلة 10. يتم اكتشاف الأعمدة تلقائياً دون مخطط ثابت.")}
        </p>
        {insightStats && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>إجمالي الرؤى: {formatStatCount(insightStats.insights_total)}</span>
            {Object.entries(insightStats.by_type ?? {}).map(([type, count]) => (
              <span key={type} className="rounded-full bg-muted px-2 py-0.5">
                {insightTypeLabel(type)}: {formatStatCount(typeof count === 'number' ? count : Number(count ?? 0))}
              </span>
            ))}
          </div>
        )}
      </header>

      {biSummary?.length ? (
        <Card className="border-border/40 bg-background/80 shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold text-foreground">{translate("BI narrative overview")}</CardTitle>
                <CardDescription>{translate("Assistant-ready summary of the current BI dataset and narratives.")}</CardDescription>
              </div>
              <HelpTrigger
                topicId="bi.overview"
                aria-label={translate("Explain the BI workspace")}
                variant="link"
                buildTopic={() => ({
                  title: translate("Story-driven BI workspace"),
                  summary: translate("This page blends curated KPIs, correlations, and AI narratives derived from phases 08-10."),
                  detailItems: biSummary,
                  sources: [
                    {
                      label: translate("Phase 08 insights"),
                      description: translate("Profiling and exploratory analysis feeding this BI story."),
                    },
                    {
                      label: translate("Phase 09 validation"),
                      description: translate("SLA and business validation gates referenced in the KPIs."),
                    },
                    {
                      label: translate("Phase 10 semantic marts"),
                      description: translate("Published metrics powering the charts and narratives."),
                    },
                  ],
                  suggestedQuestions: [
                    translate("Which dimension is driving the latest KPI swings?"),
                    translate("What anomalies should I discuss with operations?"),
                  ],
                  onAsk: () => {
                    setActiveTab('narrative');
                    setSidePanelOpen(true);
                  },
                })}
              >
                {translate("Open help center")}
              </HelpTrigger>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {biSummary.map((entry, index) => (
                <li key={`bi-summary-${index}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
            <CorrelationListCard
              title="روابط عددية (RAW)"
              items={rawNumericHighlights}
              limit={4}
              emptyMessage="لا توجد ارتباطات عددية في البيانات الخام."
            />

            <CorrelationListCard
              title="روابط زمنية (RAW)"
              items={rawDatetimeHighlights}
              limit={4}
              emptyMessage="لا توجد ارتباطات زمنية في البيانات الخام."
            />

            <CorrelationListCard
              title="روابط أعمال (RAW)"
              items={rawBusinessNumeric}
              limit={4}
              emptyMessage="لا توجد روابط أعمال في البيانات الخام."
            />

            <CorrelationListCard
              title="أثر الفئات على المقاييس (RAW)"
              items={rawBusinessNumericCategorical}
              limit={4}
              emptyMessage="لا توجد روابط فئوية في البيانات الخام."
            />
            <CorrelationListCard
              title="روابط الفئات (RAW)"
              items={rawBusinessCategorical}
              limit={4}
              emptyMessage="لا توجد روابط فئات في البيانات الخام."
            />

          </div>

          {hasAnyTrendChart ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {dailyTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">الطلبات حسب اليوم</h3>
                  <Layer1Chart
                    key={`daily-trend-${dailyTrendChart.data?.length || 0}`}
                    type={dailyTrendChart.type}
                    data={dailyTrendChart.data}
                    x={dailyTrendChart.x}
                    y={dailyTrendChart.y}
                    secondaryY={dailyTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات يومية."
                    debugId="daily-trend"
                  />
                </div>
              ) : null}
              {weekdayTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">التوزيع حسب أيام الأسبوع</h3>
                  <Layer1Chart
                    type={weekdayTrendChart.type}
                    data={weekdayTrendChart.data}
                    x={weekdayTrendChart.x}
                    y={weekdayTrendChart.y}
                    secondaryY={weekdayTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات أسبوعية."
                    debugId="weekday-trend"
                  />
                </div>
              ) : null}
              {hourTrendChart ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">الطلبات حسب الساعة</h3>
                  <Layer1Chart
                    type={hourTrendChart.type}
                    data={hourTrendChart.data}
                    x={hourTrendChart.x}
                    y={hourTrendChart.y}
                    secondaryY={hourTrendChart.secondary_y}
                    emptyMessage="لا توجد بيانات زمنية."
                    debugId="hour-trend"
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
                        <Layer1Chart
                          type={resolvedBreakdownChart.type}
                          data={resolvedBreakdownChart.data}
                          x={resolvedBreakdownChart.x}
                          y={resolvedBreakdownChart.y}
                          secondaryY={resolvedBreakdownChart.secondary_y}
                          emptyMessage="لا توجد بيانات كافية للرسم."
                          debugId={`breakdown-${breakdownKey}`}
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

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 shadow-sm" dir="rtl">
        <Select value={correlationFilterState.kpi} onValueChange={(value) => handleCorrelationFilterChange('kpi', value)}>
          <SelectTrigger className="w-[220px] justify-between">
            <SelectValue placeholder="كل مؤشرات الأداء" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل مؤشرات الأداء</SelectItem>
            {correlationKpiOptions.map((option) => (
              <SelectItem key={`kpi-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={correlationFilterState.domain} onValueChange={(value) => handleCorrelationFilterChange('domain', value)}>
          <SelectTrigger className="w-[200px] justify-between">
            <SelectValue placeholder="كل المجالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المجالات</SelectItem>
            {correlationDomainOptions.map((domain) => (
              <SelectItem key={`domain-${domain}`} value={domain}>
                {domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={correlationFilterState.direction} onValueChange={(value) => handleCorrelationFilterChange('direction', value)}>
          <SelectTrigger className="w-[200px] justify-between">
            <SelectValue placeholder="اتجاه الارتباط" />
          </SelectTrigger>
          <SelectContent>
            {directionOptions.map((option) => (
              <SelectItem key={`direction-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
          <Switch id="correlation-persistent-only" checked={correlationFilterState.persistentOnly} onCheckedChange={handleCorrelationPersistenceToggle} />
          <Label htmlFor="correlation-persistent-only" className="text-xs text-muted-foreground">
            عرض الأنماط المستقرة فقط
          </Label>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={resetCorrelationFilters} disabled={!isCorrelationFilterActive}>
          إعادة التصفية
        </Button>
      </div>
      {correlationError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground" dir="rtl">
          فشل توليد الشرح: {correlationError}
        </div>
      ) : null}

      <Layer2InsightsPanel className="mt-6" />

      <Layer3IntelligencePanel intelligence={intelligence} className="mt-6" />

      <KnimeResultsPanel data={intelligence.knime} className="lg:w-3/4" />

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
            <Layer1KpiCard
              key={summary.metric.id}
              title={summary.metric.title ?? summary.metric.id}
              value={summary.value}
              delta={wowDelta}
              deltaLabel="التغير الأسبوعي"
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CorrelationListCard
          title="أبرز الارتباطات العددية"
          items={numericHighlights}
          limit={6}
          emptyMessage="لا توجد ارتباطات عددية متاحة."
          onExplain={handleExplainCorrelation}
          explanations={correlationExplanations}
          explainingKey={correlationExplainingKey}
        />
        <CorrelationListCard
          title="أبرز الارتباطات الزمنية"
          items={datetimeHighlights}
          limit={6}
          emptyMessage="لا توجد ارتباطات زمنية متاحة."
          onExplain={handleExplainCorrelation}
          explanations={correlationExplanations}
          explainingKey={correlationExplainingKey}
        />
        <CorrelationListCard
          title="روابط أعمال"
          items={businessNumericHighlights}
          limit={6}
          emptyMessage="لا توجد روابط أعمال حالياً."
          onExplain={handleExplainCorrelation}
          explanations={correlationExplanations}
          explainingKey={correlationExplainingKey}
        />
        <CorrelationListCard
          title="أثر الفئات على المقاييس"
          items={businessNumericCategoricalHighlights}
          limit={6}
          emptyMessage="لا توجد روابط فئوية حالياً."
          onExplain={handleExplainCorrelation}
          explanations={correlationExplanations}
          explainingKey={correlationExplainingKey}
        />
        <CorrelationListCard
          title="روابط فئات متبادلة"
          items={businessCategoricalHighlights}
          limit={6}
          emptyMessage="لا توجد روابط فئات متاحة."
          onExplain={handleExplainCorrelation}
          explanations={correlationExplanations}
          explainingKey={correlationExplainingKey}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-start">لوحة الرؤى</h2>
          {activeTab === 'narrative' ? (
            renderNarrative()
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-start">{canvasNarrative}</p>
              {activeConfig?.chartType && column ? (
                <Layer1Chart
                  type={activeConfig.chartType}
                  data={canvasData}
                  x={canvasXAxis}
                  y={activeConfig.chartType === 'combo' ? ['value'] : 'value'}
                  secondaryY={activeConfig.chartType === 'combo' ? 'share' : undefined}
                  emptyMessage="No data available for the selected combination."
                  debugId="canvas-chart"
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
          <span className="text-xs text-muted-foreground">مدعوم بمقاييس وأبعاد محلية.</span>
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
          {chatLoading && (
            <div className="flex justify-end">
              <span className="inline-flex max-w-[75%] rounded-2xl px-3 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                المساعد يعمل على التحليل...
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="اطلب مؤشراً أو بُعداً..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={chatLoading}
            className={`rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 ${
              chatLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {chatLoading ? 'جاري التحليل...' : 'Send'}
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















