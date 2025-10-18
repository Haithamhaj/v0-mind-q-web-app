"use client";

import React, { useMemo } from "react";
import clsx from "clsx";

type KpiCardProps = {
  title: string;
  value: number | string;
  delta?: number | null;
  deltaLabel?: string;
  trendSpark?: number[];
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
};

const formatNumber = (input: number | string): string => {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return typeof input === "string" ? input : String(input ?? "");
  }

  const isInteger = Number.isInteger(input);
  const value = isInteger ? input : Number(input.toFixed(2));
  const [integerPart, fractionalPart] = value.toString().split(".");
  const sign = integerPart.startsWith("-") ? "-" : "";
  const digits = sign ? integerPart.slice(1) : integerPart;
  const groupedInteger = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (isInteger) {
    return `${sign}${groupedInteger}`;
  }

  const paddedFraction = (fractionalPart ?? "").padEnd(2, "0").slice(0, 2);
  return `${sign}${groupedInteger}.${paddedFraction}`;
};

const Sparkline = ({ points }: { points: number[] }) => {
  const normalized = useMemo(() => {
    if (!points.length) {
      return [];
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points.map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    });
  }, [points]);

  return (
    <svg viewBox="0 0 100 100" className="h-12 w-full text-primary/70" role="img" aria-label="Trend sparkline">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={normalized.join(" ")}
        className="transition-[stroke] duration-200 ease-out"
      />
    </svg>
  );
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  delta,
  deltaLabel = "WoW",
  trendSpark,
  onClick,
  active = false,
  loading = false,
}) => {
  const signClass =
    typeof delta === "number"
      ? delta > 0
        ? "text-emerald-500 dark:text-emerald-400"
        : delta < 0
        ? "text-rose-500 dark:text-rose-400"
        : "text-muted-foreground"
      : "text-muted-foreground";

  let formattedDelta: string;
  if (typeof delta === "number" && Number.isFinite(delta)) {
    const symbol = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "FLAT";
    formattedDelta = `${symbol} ${Math.abs(delta).toFixed(2)}%`;
  } else {
    formattedDelta = "N/A";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative flex w-full flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 text-start shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        active && "ring-2 ring-primary/70",
        loading && "animate-pulse cursor-progress",
      )}
      disabled={loading}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          <span className="text-2xl font-semibold tracking-tight">{formatNumber(value)}</span>
        </div>
        <span className={clsx("rounded-full px-2 py-1 text-xs font-medium", signClass)}>
          {deltaLabel} {formattedDelta}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {trendSpark && trendSpark.length > 1 ? (
          <Sparkline points={trendSpark} />
        ) : (
          <div className="flex h-12 w-full items-center justify-center rounded-xl bg-muted/60 text-xs font-medium text-muted-foreground">
            N/A
          </div>
        )}
      </div>
      <span className="pointer-events-none absolute inset-x-3 bottom-3 h-[2px] origin-center scale-x-0 rounded-full bg-primary/70 transition-transform duration-200 ease-out group-hover:scale-x-100" />
    </button>
  );
};

export default KpiCard;
