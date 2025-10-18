import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CorrelationPair } from "../data";

type CorrelationListCardProps = {
  title: string;
  items: CorrelationPair[];
  limit?: number;
  emptyMessage?: string;
};

const correlationFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const formatCorrelation = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "???";
  }
  return correlationFormatter.format(Number(value));
};

const formatSample = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "???";
  }
  return integerFormatter.format(Math.round(Number(value)));
};

export const CorrelationListCard: React.FC<CorrelationListCardProps> = ({
  title,
  items,
  limit = 6,
  emptyMessage = "لا توجد بيانات ارتباط متاحة.",
}) => {
  const resolved = Array.isArray(items) ? items.slice(0, limit) : [];

  return (
    <Card className="border-border/40 bg-background/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {resolved.map((item) => {
              const key = `${item.feature_a}::${item.feature_b}`;
              const correlationValue = formatCorrelation(item.correlation);
              const sampleLabel = formatSample(item.sample_size);
              const tone =
                item.correlation !== undefined && item.correlation !== null && Number(item.correlation) < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-300";
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-muted/10 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{item.feature_a}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.feature_b}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${tone}`}>{correlationValue}</div>
                    <div className="text-xs text-muted-foreground">n≈{sampleLabel}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default CorrelationListCard;
