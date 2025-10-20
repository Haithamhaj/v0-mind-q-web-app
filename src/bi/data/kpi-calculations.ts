"use client";

import { useMemo } from "react";
import { BiDatasetRow } from "./types";

export interface KpiValues {
  totalOrders: number | null;
  codTotal: number | null;
  codAvg: number | null;
  codRatePct: number | null;
  slaPct: number | null;
  rtoPct: number | null;
  leadTimeP50: number | null;
  leadTimeP90: number | null;
  timezone?: string;
  currency?: string;
  lastUpdated?: string;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normaliseTimestamp = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return new Date(value as number | string).toISOString();
  } catch {
    return undefined;
  }
};

export const useKpiCalculations = (dataset: BiDatasetRow[]): KpiValues => {
  return useMemo(() => {
    if (!dataset || dataset.length === 0) {
      return {
        totalOrders: null,
        codTotal: null,
        codAvg: null,
        codRatePct: null,
        slaPct: null,
        rtoPct: null,
        leadTimeP50: null,
        leadTimeP90: null,
        timezone: undefined,
        currency: undefined,
        lastUpdated: undefined,
      };
    }

    const sample = dataset[0] ?? {};
    const orders = toNumber((sample as any)?.kpi_orders_cnt ?? (sample as any)?.orders_cnt);
    const codTotal = toNumber((sample as any)?.kpi_cod_total ?? (sample as any)?.cod_total);
    const codAvg = toNumber((sample as any)?.kpi_cod_avg ?? (sample as any)?.cod_avg);
    const codRateRaw = toNumber((sample as any)?.kpi_cod_rate ?? (sample as any)?.cod_rate);
    const slaPctRaw = toNumber((sample as any)?.kpi_sla_pct);
    const rtoPctRaw = toNumber((sample as any)?.kpi_rto_pct);
    const leadP50 = toNumber((sample as any)?.kpi_lead_time_p50);
    const leadP90 = toNumber((sample as any)?.kpi_lead_time_p90);

    const timezone =
      (sample as any)?.tz ?? (sample as any)?.timezone ?? (sample as any)?.time_zone ?? undefined;
    const currency = (sample as any)?.currency ?? undefined;
    const lastUpdated = normaliseTimestamp((sample as any)?.ts ?? (sample as any)?.timestamp);

    return {
      totalOrders: orders,
      codTotal,
      codAvg,
      codRatePct: codRateRaw !== null ? codRateRaw * 100 : null,
      slaPct: slaPctRaw !== null ? slaPctRaw * 100 : null,
      rtoPct: rtoPctRaw !== null ? rtoPctRaw * 100 : null,
      leadTimeP50: leadP50,
      leadTimeP90: leadP90,
      timezone: typeof timezone === "string" ? timezone : undefined,
      currency: typeof currency === "string" ? currency : undefined,
      lastUpdated,
    };
  }, [dataset]);
};

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(2)} ر.س`;
};

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  try {
    return new Intl.NumberFormat("ar-SA", {
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  } catch {
    return value.toFixed(0);
  }
};

export const formatPercentage = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(digits)}%`;
};
