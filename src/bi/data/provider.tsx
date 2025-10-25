"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fallbackCorrelations, fallbackDataset, fallbackDimensions, fallbackInsights, fallbackMetrics } from "./fallback";
import { mockDataset, mockDimensions, mockInsights, mockMetrics } from "./mocks";
import {
  BiDataContextValue,
  BiDatasetRow,
  CatalogMetadata,
  CorrelationCollection,
  DimensionsCatalog,
  Insight,
  InsightStats,
  MetricSpec,
} from "./types";

type EndpointOverrides = Partial<Record<"metrics" | "dimensions" | "insights" | "dataset" | "correlations", string>>;

type BiDataProviderProps = {
  children: React.ReactNode;
  endpoints?: EndpointOverrides;
};

const MAX_ROWS = 25_000;
const DEFAULT_BASE = process.env.NEXT_PUBLIC_BI_BASE ?? "/api/bi";
const DEFAULT_RUN = process.env.NEXT_PUBLIC_BI_RUN ?? "run-latest";

const BiDataContext = createContext<BiDataContextValue | undefined>(undefined);

const clampRows = (rows: BiDatasetRow[] | undefined | null): BiDatasetRow[] => {
  if (!rows?.length) {
    return [];
  }
  return rows.slice(0, MAX_ROWS);
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/g)
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;
const ALPHANUMERIC_REGEX = /^[a-z0-9/]+$/i;

const CANONICAL_DIMENSION_ALIASES: Record<string, Record<string, string>> = {
  payment_method: {
    cc: "CC",
    "credit card": "CC",
    "credit_card": "CC",
    "credit-card": "CC",
    "creditcard": "CC",
    cod: "COD",
    "cash on delivery": "COD",
    "cash-on-delivery": "COD",
    "cash_on_delivery": "COD",
  },
  destination: {
    riyadh: "Riyadh",
    "riyadh city": "Riyadh",
    "al riyadh": "Riyadh",
    "ar riyadh": "Riyadh",
    الرياض: "الرياض",
    makkah: "Makkah",
    "makkah province": "Makkah Province",
    مكة: "مكة",
    جدة: "جدة",
    jeddah: "Jeddah",
    dammam: "Dammam",
    الدمام: "الدمام",
    medina: "Medina",
    المدينة: "المدينة",
    madinah: "Medina",
    "al madinah": "Medina",
  },
};

const canonicalizeDimensionValue = (dimensionKey: string, rawValue: string): string => {
  const lowerValue = rawValue.toLowerCase();
  const aliasMap = CANONICAL_DIMENSION_ALIASES[dimensionKey];
  if (aliasMap?.[lowerValue]) {
    return aliasMap[lowerValue];
  }

  if (ARABIC_CHAR_REGEX.test(rawValue)) {
    return rawValue;
  }

  if (ALPHANUMERIC_REGEX.test(rawValue) && rawValue.length <= 3) {
    return rawValue.toUpperCase();
  }

  if (/^\d+$/.test(rawValue)) {
    return rawValue;
  }

  return titleCase(rawValue);
};

const normalizeCategoricalValues = (rows: BiDatasetRow[], dimensions: DimensionsCatalog | undefined | null) => {
  if (!rows.length) {
    return rows;
  }

  const categoricalColumns = new Map(
    (dimensions?.categorical ?? [])
      .map((dimension) => dimension.name?.trim())
      .filter((name): name is string => Boolean(name && name.length > 0))
      .map((name) => [name.toLowerCase(), name]),
  );

  if (!categoricalColumns.size) {
    return rows;
  }

  return rows.map((row) => {
    const normalized: BiDatasetRow = { ...row };
    for (const key of Object.keys(row)) {
      const keyLower = key.trim().toLowerCase();
      if (!categoricalColumns.has(keyLower)) {
        continue;
      }
      const value = row[key];
      if (typeof value !== "string") {
        continue;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        normalized[key] = "";
        continue;
      }
      const collapsed = trimmed.replace(/\s+/g, " ");
      const canonical = canonicalizeDimensionValue(keyLower, collapsed);
      normalized[key] = canonical;
    }
    return normalized;
  });
};

const buildDefaultEndpoints = (): Required<EndpointOverrides> => ({
  metrics: `${DEFAULT_BASE}/metrics`,
  dimensions: `${DEFAULT_BASE}/dimensions?run=${encodeURIComponent(DEFAULT_RUN)}`,
  insights: `${DEFAULT_BASE}/insights?run=${encodeURIComponent(DEFAULT_RUN)}`,
  dataset: `${DEFAULT_BASE}/orders?run=${encodeURIComponent(DEFAULT_RUN)}`,
  correlations: `${DEFAULT_BASE}/correlations?run=${encodeURIComponent(DEFAULT_RUN)}&top=50`,
});

const fetchJson = async <T,>(url: string | undefined, fallback: T): Promise<T> => {
  if (!url) {
    return fallback;
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn("[story-bi] falling back for", url, error);
    return fallback;
  }
};

const fetchDataset = async (url: string | undefined, fallback: BiDatasetRow[]): Promise<BiDatasetRow[]> => {
  if (!url) {
    return fallback;
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    // Handle the specific structure returned by the API
    if (data && data.rows && Array.isArray(data.rows)) {
      return data.rows as BiDatasetRow[];
    }
    // If it's already an array, return it
    if (Array.isArray(data)) {
      return data as BiDatasetRow[];
    }
    throw new Error("Invalid dataset format received from API");
  } catch (error) {
    console.warn("[story-bi] falling back for dataset", url, error);
    return fallback;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normaliseMetricsPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return { metrics: payload as MetricSpec[], metadata: {} as Record<string, unknown> };
  }
  if (isRecord(payload)) {
    const metrics = Array.isArray(payload.metrics) ? (payload.metrics as MetricSpec[]) : [];
    const metadata =
      isRecord(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "metrics"));
    return { metrics, metadata };
  }
  return { metrics: fallbackMetrics.length ? fallbackMetrics : mockMetrics, metadata: {} as Record<string, unknown> };
};

const normaliseDimensionsPayload = (payload: unknown) => {
  if (isRecord(payload) && Array.isArray(payload.date) && Array.isArray(payload.numeric) && Array.isArray(payload.categorical)) {
    const catalog: DimensionsCatalog = {
      generated_at: typeof payload.generated_at === "string" ? payload.generated_at : undefined,
      row_count: typeof payload.row_count === "number" ? payload.row_count : undefined,
      date: payload.date as DimensionsCatalog["date"],
      numeric: payload.numeric as DimensionsCatalog["numeric"],
      categorical: payload.categorical as DimensionsCatalog["categorical"],
      bool: Array.isArray(payload.bool) ? (payload.bool as DimensionsCatalog["bool"]) : [],
    };
    const metadata = isRecord(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(payload).filter(
            ([key]) => !["generated_at", "row_count", "date", "numeric", "categorical", "bool"].includes(key),
          ),
        );
    return { catalog, metadata };
  }
  return {
    catalog: fallbackDimensions.date.length ? fallbackDimensions : mockDimensions,
    metadata: {} as Record<string, unknown>,
  };
};

const normaliseInsightsPayload = (payload: unknown) => {
  if (isRecord(payload)) {
    const insights = Array.isArray(payload.insights) ? (payload.insights as Insight[]) : [];
    const statsRaw = isRecord(payload.stats) ? (payload.stats as Record<string, unknown>) : undefined;
    const stats: InsightStats | undefined = statsRaw
      ? {
          insights_total: typeof statsRaw.insights_total === "number" ? statsRaw.insights_total : undefined,
          by_type: isRecord(statsRaw.by_type) ? (statsRaw.by_type as Record<string, number>) : undefined,
        }
      : undefined;
    const metadata: Record<string, unknown> = {};
    if (typeof payload.generated_at === "string") {
      metadata.generated_at = payload.generated_at;
    }
    if (isRecord(payload.sources)) {
      metadata.sources = payload.sources;
    }
    if (Array.isArray(payload.log)) {
      metadata.log = payload.log;
    }
    return { insights, stats, metadata };
  }
  if (Array.isArray(payload)) {
    return { insights: payload as Insight[], stats: undefined, metadata: {} as Record<string, unknown> };
  }
  return {
    insights: fallbackInsights.length ? fallbackInsights : mockInsights,
    stats: undefined,
    metadata: {} as Record<string, unknown>,
  };
};

export const BiDataProvider: React.FC<BiDataProviderProps> = ({ children, endpoints }) => {
  const mergedEndpoints = { ...buildDefaultEndpoints(), ...endpoints };

  const [metrics, setMetrics] = useState<MetricSpec[]>(fallbackMetrics.length ? fallbackMetrics : mockMetrics);
  const initialDimensions = fallbackDimensions.date.length ? fallbackDimensions : mockDimensions;
  const initialDataset = fallbackDataset.length ? clampRows(fallbackDataset) : clampRows(mockDataset);
  const [dimensions, setDimensions] = useState<DimensionsCatalog>(initialDimensions);
  const [insights, setInsights] = useState<Insight[]>(fallbackInsights.length ? fallbackInsights : mockInsights);
  const [dataset, setDataset] = useState<BiDatasetRow[]>(normalizeCategoricalValues(initialDataset, initialDimensions));
  const [correlations, setCorrelations] = useState<CorrelationCollection>(
    fallbackCorrelations,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [catalogMeta, setCatalogMeta] = useState<CatalogMetadata>({});
  const [insightStats, setInsightStats] = useState<InsightStats | undefined>(undefined);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [metricsRes, dimensionsRes, insightsRes, datasetRes, correlationsRes] = await Promise.all([
          fetchJson<unknown>(mergedEndpoints.metrics, { metrics: fallbackMetrics }),
          fetchJson<unknown>(mergedEndpoints.dimensions, fallbackDimensions),
          fetchJson<unknown>(mergedEndpoints.insights, { insights: fallbackInsights }),
          fetchDataset(mergedEndpoints.dataset, fallbackDataset),
          fetchJson<CorrelationCollection>(mergedEndpoints.correlations, fallbackCorrelations),
        ]);

        if (!active) return;

        const metricsPayload = normaliseMetricsPayload(metricsRes);
        const resolvedMetrics =
          metricsPayload.metrics.length > 0 ? metricsPayload.metrics : fallbackMetrics.length ? fallbackMetrics : mockMetrics;
        const dimensionsPayload = normaliseDimensionsPayload(dimensionsRes);
        const hasDimensionSignals =
          (dimensionsPayload.catalog.categorical?.length ?? 0) +
            (dimensionsPayload.catalog.numeric?.length ?? 0) +
            (dimensionsPayload.catalog.date?.length ?? 0) >
          0;
        const resolvedDimensions = hasDimensionSignals
          ? dimensionsPayload.catalog
          : fallbackDimensions.date.length
            ? fallbackDimensions
            : mockDimensions;
        const insightsPayload = normaliseInsightsPayload(insightsRes);
        const resolvedInsights =
          insightsPayload.insights.length > 0 ? insightsPayload.insights : fallbackInsights.length ? fallbackInsights : mockInsights;
        const resolvedDatasetSource =
          datasetRes?.length
            ? clampRows(datasetRes)
            : fallbackDataset.length
              ? clampRows(fallbackDataset)
              : clampRows(mockDataset);
        const resolvedDataset = normalizeCategoricalValues(resolvedDatasetSource, resolvedDimensions);

        setMetrics(resolvedMetrics);
        setDimensions(resolvedDimensions);
        setInsights(resolvedInsights);
        setDataset(resolvedDataset);
        setCatalogMeta({
          metrics: metricsPayload.metadata,
          dimensions: dimensionsPayload.metadata,
          insights: insightsPayload.metadata,
        });
        setInsightStats(insightsPayload.stats);
        const resolvedCorrelations =
          correlationsRes && Array.isArray(correlationsRes.numeric) && Array.isArray(correlationsRes.datetime)
            ? {
                numeric: correlationsRes.numeric ?? [],
                datetime: correlationsRes.datetime ?? [],
                business:
                  correlationsRes.business ??
                  {
                    numeric_numeric: [],
                    numeric_categorical: [],
                    categorical_categorical: [],
                  },
                sources: {
                  ...(fallbackCorrelations.sources ?? {}),
                  ...(correlationsRes.sources ?? {}),
                },
                run: correlationsRes.run ?? fallbackCorrelations.run ?? "run-latest",
                artifacts_root: correlationsRes.artifacts_root ?? fallbackCorrelations.artifacts_root ?? null,
                top: correlationsRes.top ?? fallbackCorrelations.top ?? null,
              }
            : fallbackCorrelations;
        setCorrelations(resolvedCorrelations);
        setError(undefined);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "تعذر تحميل بيانات الـ BI";
        setError(message);
        setMetrics(fallbackMetrics.length ? fallbackMetrics : mockMetrics);
        setDimensions(fallbackDimensions.date.length ? fallbackDimensions : mockDimensions);
        setInsights(fallbackInsights.length ? fallbackInsights : mockInsights);
        setDataset(fallbackDataset.length ? clampRows(fallbackDataset) : clampRows(mockDataset));
        setCorrelations(fallbackCorrelations);
        setCatalogMeta({});
        setInsightStats(undefined);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [mergedEndpoints.metrics, mergedEndpoints.dimensions, mergedEndpoints.insights, mergedEndpoints.dataset, mergedEndpoints.correlations]);

  const value = useMemo<BiDataContextValue>(
    () => ({
      metrics,
      dimensions,
      insights,
      dataset,
      correlations,
      loading,
      error,
      filters,
      insightStats,
      catalogMeta,
      setFilter: (dimension: string, values: string[]) => {
        const nextValues = values.filter(Boolean);
        setFilters((prev) => {
          const updated = nextValues.length
            ? {
                ...prev,
                [dimension]: nextValues,
              }
            : Object.fromEntries(Object.entries(prev).filter(([key]) => key !== dimension));
          console.info("[story-bi] filter changed", dimension, nextValues);
          console.count("[story-bi] filter change");
          return updated;
        });
      },
    }),
    [metrics, dimensions, insights, dataset, correlations, loading, error, filters, insightStats, catalogMeta],
  );

  return <BiDataContext.Provider value={value}>{children}</BiDataContext.Provider>;
};

export const useBiDataContext = (): BiDataContextValue => {
  const context = useContext(BiDataContext);
  if (!context) {
    throw new Error("useBiDataContext must be used within a BiDataProvider");
  }
  return context;
};



