import React from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CorrelationPair } from "../data";

type CorrelationInsight = {
  summary?: string;
  recommended_actions?: string[];
  confidence?: string | null;
  mode?: string | null;
};

export const correlationPairKey = (item: CorrelationPair): string => {
  const ordered = [String(item.feature_a ?? ""), String(item.feature_b ?? "")].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return `${ordered[0]}::${ordered[1]}::${item.kind ?? "numeric"}`;
};

type CorrelationListCardProps = {
  title: string;
  items: CorrelationPair[];
  limit?: number;
  emptyMessage?: string;
  explanations?: Record<string, CorrelationInsight | undefined>;
  explainingKey?: string | null;
  onExplain?: (item: CorrelationPair) => void;
};

const correlationFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US");
const pValueFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const formatCorrelation = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return correlationFormatter.format(Number(value));
};

const formatSample = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return integerFormatter.format(Math.round(Number(value)));
};

const formatPValue = (value?: number | null): string | undefined => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return undefined;
  }
  if (value < 0.001) {
    return "<0.001";
  }
  return pValueFormatter.format(value);
};

const directionTone = (direction?: string | null, correlation?: number | null) => {
  if (direction === "worsens" || (direction === undefined && typeof correlation === "number" && correlation < 0)) {
    return "text-rose-600 dark:text-rose-400";
  }
  return "text-emerald-600 dark:text-emerald-300";
};

const formatImpact = (item: CorrelationPair): string | undefined => {
  if (typeof item.expected_kpi_delta_pct === "number" && Number.isFinite(item.expected_kpi_delta_pct)) {
    const delta = item.expected_kpi_delta_pct;
    const formatted = delta.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${delta >= 0 ? "+" : ""}${formatted}%`;
  }
  if (typeof item.expected_kpi_delta === "number" && Number.isFinite(item.expected_kpi_delta)) {
    const formatted = item.expected_kpi_delta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (item.kpi_unit && item.kpi_unit.toLowerCase().includes("currency")) {
      return `${item.expected_kpi_delta >= 0 ? "+" : ""}${formatted} ${item.kpi_unit.toUpperCase()}`;
    }
    return `${item.expected_kpi_delta >= 0 ? "+" : ""}${formatted}`;
  }
  return undefined;
};

const formatMethod = (method?: string): string | undefined => {
  if (!method) {
    return undefined;
  }
  const normalized = method.toLowerCase();
  if (normalized === "pearson") {
    return "Pearson r";
  }
  if (normalized === "eta_squared") {
    return "Eta²";
  }
  if (normalized.startsWith("cramer")) {
    return "Cramer's V";
  }
  return method.replace(/_/g, " ");
};

const resolveLabel = (primary?: string | null, fallback?: string | null) => {
  const label = primary ?? fallback ?? "";
  return label.replace(/_/g, " ").trim();
};

export const CorrelationListCard: React.FC<CorrelationListCardProps> = ({
  title,
  items,
  limit = 6,
  emptyMessage = "?? ???? ????? ????? ???????.",
  explanations,
  explainingKey,
  onExplain,
}) => {
  const resolved = Array.isArray(items) ? items.slice(0, limit) : [];

  return (
    <Card className="border-border/40 bg-background/80 shadow-sm" dir="rtl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {resolved.map((item) => {
              const key = correlationPairKey(item);
              const isLoading = explainingKey === key;
              const explanation = explanations?.[key];
              const correlationValue = formatCorrelation(item.correlation);
              const sampleLabel = formatSample(item.sample_size);
              const methodLabel = formatMethod(item.method);
              const pValue = formatPValue(item.p_value);
              const tone = directionTone(item.effect_direction, item.correlation);
              const impactLabel = formatImpact(item);

              const primaryLabel = item.business_label || `${resolveLabel(item.feature_a_label, item.feature_a)} ↔ ${resolveLabel(item.feature_b_label, item.feature_b)}`;
              const driverDomain =
                item.driver_domain ||
                (item.kpi_feature && item.kpi_feature === item.feature_a ? item.feature_b_domain : item.feature_a_domain) ||
                item.feature_b_domain ||
                item.feature_a_domain;

              const directionLabel =
                item.effect_direction === "improves"
                  ? "يحسّن KPI"
                  : item.effect_direction === "worsens"
                    ? "يضعف KPI"
                    : undefined;

              return (
                <li key={key} className="rounded-2xl border border-border/40 bg-muted/10 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-border">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{primaryLabel}</span>
                          {item.is_persistent && (
                            <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">
                              نمط مستقر
                            </Badge>
                          )}
                          {item.kpi_label && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {item.kpi_label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {driverDomain && (
                            <Badge variant="outline" className="border-border/50 bg-background/60 text-muted-foreground">
                              {driverDomain}
                            </Badge>
                          )}
                          {directionLabel && (
                            <Badge
                              variant="outline"
                              className={clsx(
                                "border-transparent",
                                item.effect_direction === "improves" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {directionLabel}
                            </Badge>
                          )}
                          {item.history_runs?.length ? (
                            <Badge variant="outline" className="border-border/50 bg-background/60 text-muted-foreground">
                              ظهر في {item.history_runs.length} تشغيل
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex min-w-[120px] flex-col items-end gap-1 text-end">
                        <span className={clsx("flex items-center gap-1 text-sm font-semibold", tone)}>
                          {item.correlation !== undefined && item.correlation !== null ? (
                            item.correlation >= 0 ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )
                          ) : null}
                          {correlationValue}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          n≈{sampleLabel}
                          {pValue ? ` · p=${pValue}` : ""}
                          {methodLabel ? ` · ${methodLabel}` : ""}
                        </span>
                        {impactLabel && (
                          <span className="text-[11px] font-medium text-primary">
                            الأثر المتوقع: {impactLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.impact_summary && (
                      <p className="text-xs text-muted-foreground">{item.impact_summary}</p>
                    )}
                    <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span className="truncate">{item.source ?? ""}</span>
                      {onExplain ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => onExplain(item)}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          <span>{isLoading ? "جاري التحليل..." : "شرح"}</span>
                        </Button>
                      ) : null}
                    </div>
                    {isLoading && (
                      <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
                        جاري توليد الشرح المدعوم بالذكاء الاصطناعي...
                      </div>
                    )}
                    {!isLoading && explanation && (explanation.summary || explanation.recommended_actions?.length) ?
                      (
                        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary-foreground/90 shadow-sm">
                          {explanation.summary && <p className="font-medium text-primary">{explanation.summary}</p>}
                          {explanation.recommended_actions && explanation.recommended_actions.length > 0 && (
                            <ul className="mt-2 space-y-1 text-right leading-relaxed">
                              {explanation.recommended_actions.map((action, index) => (
                                <li key={`${key}-action-${index}`} className="flex items-start gap-2">
                                  <span className="text-primary/70">•</span>
                                  <span className="flex-1">{action}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] uppercase text-muted-foreground">
                            {explanation.confidence && <span>الثقة: {explanation.confidence}</span>}
                            {explanation.mode && <span>المصدر: {explanation.mode}</span>}
                          </div>
                        </div>
                      ) : null}
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





