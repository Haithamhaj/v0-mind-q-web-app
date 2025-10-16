'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';

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

  const numericSeries = rows
    .map((row) => {
      const value = Number(row[column]);
      const timestamp = timeColumn ? row[timeColumn] : undefined;
      return { value, timestamp: timestamp ? String(timestamp) : undefined };
    })
    .filter((entry) => Number.isFinite(entry.value));

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
