"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fallbackDataset, fallbackDimensions, fallbackInsights, fallbackMetrics } from "./fallback";
import { mockDataset, mockDimensions, mockInsights, mockMetrics } from "./mocks";
import { BiDataContextValue, BiDatasetRow, DimensionsCatalog, Insight, MetricSpec } from "./types";

type EndpointOverrides = Partial<Record<"metrics" | "dimensions" | "insights" | "dataset", string>>;

type BiDataProviderProps = {
  children: React.ReactNode;
  endpoints?: EndpointOverrides;
};

const MAX_ROWS = 10_000;
const DEFAULT_BASE = process.env.NEXT_PUBLIC_BI_BASE ?? "/api/bi";
const DEFAULT_RUN = process.env.NEXT_PUBLIC_BI_RUN ?? "run-latest";

const BiDataContext = createContext<BiDataContextValue | undefined>(undefined);

const clampRows = (rows: BiDatasetRow[] | undefined | null): BiDatasetRow[] => {
  if (!rows?.length) {
    return [];
  }
  return rows.slice(0, MAX_ROWS);
};

const buildDefaultEndpoints = (): Required<EndpointOverrides> => ({
  metrics: `${DEFAULT_BASE}/metrics`,
  dimensions: `${DEFAULT_BASE}/dimensions?run=${encodeURIComponent(DEFAULT_RUN)}`,
  insights: `${DEFAULT_BASE}/insights?run=${encodeURIComponent(DEFAULT_RUN)}`,
  dataset: `${DEFAULT_BASE}/data?run=${encodeURIComponent(DEFAULT_RUN)}`,
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

export const BiDataProvider: React.FC<BiDataProviderProps> = ({ children, endpoints }) => {
  const mergedEndpoints = { ...buildDefaultEndpoints(), ...endpoints };

  const [metrics, setMetrics] = useState<MetricSpec[]>(fallbackMetrics.length ? fallbackMetrics : mockMetrics);
  const [dimensions, setDimensions] = useState<DimensionsCatalog>(
    fallbackDimensions.date.length ? fallbackDimensions : mockDimensions,
  );
  const [insights, setInsights] = useState<Insight[]>(fallbackInsights.length ? fallbackInsights : mockInsights);
  const [dataset, setDataset] = useState<BiDatasetRow[]>(
    fallbackDataset.length ? clampRows(fallbackDataset) : clampRows(mockDataset),
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [metricsRes, dimensionsRes, insightsRes, datasetRes] = await Promise.all([
          fetchJson<MetricSpec[]>(mergedEndpoints.metrics, fallbackMetrics),
          fetchJson<DimensionsCatalog>(mergedEndpoints.dimensions, fallbackDimensions),
          fetchJson<Insight[]>(mergedEndpoints.insights, fallbackInsights),
          fetchDataset(mergedEndpoints.dataset, fallbackDataset),
        ]);

        if (!active) return;

        setMetrics(metricsRes?.length ? metricsRes : fallbackMetrics.length ? fallbackMetrics : mockMetrics);
        setDimensions(
          dimensionsRes?.categorical ? dimensionsRes : fallbackDimensions.date.length ? fallbackDimensions : mockDimensions,
        );
        setInsights(insightsRes?.length ? insightsRes : fallbackInsights.length ? fallbackInsights : mockInsights);
        setDataset(
          datasetRes?.length
            ? clampRows(datasetRes)
            : fallbackDataset.length
            ? clampRows(fallbackDataset)
            : clampRows(mockDataset),
        );
        setError(undefined);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "تعذر تحميل بيانات الـ BI";
        setError(message);
        setMetrics(fallbackMetrics.length ? fallbackMetrics : mockMetrics);
        setDimensions(fallbackDimensions.date.length ? fallbackDimensions : mockDimensions);
        setInsights(fallbackInsights.length ? fallbackInsights : mockInsights);
        setDataset(fallbackDataset.length ? clampRows(fallbackDataset) : clampRows(mockDataset));
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
  }, [mergedEndpoints.metrics, mergedEndpoints.dimensions, mergedEndpoints.insights, mergedEndpoints.dataset]);

  const value = useMemo<BiDataContextValue>(
    () => ({
      metrics,
      dimensions,
      insights,
      dataset,
      loading,
      error,
      filters,
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
    [metrics, dimensions, insights, dataset, loading, error, filters],
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
