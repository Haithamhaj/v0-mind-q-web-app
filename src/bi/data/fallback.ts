import type { BiDatasetRow, DimensionsCatalog, Insight, MetricSpec } from "./types";

export const fallbackMetrics: MetricSpec[] = [
  {
    id: "orders_volume",
    title: "Orders Volume",
    formula: "SUM(kpi_orders_cnt)",
    unit: "count",
    fmt: "integer",
    join_keys: ["entity_id", "scenario_id"],
    time_col: "ts",
  },
  {
    id: "cod_collected_total",
    title: "COD Collected (Total)",
    formula: "SUM(kpi_cod_total)",
    unit: "amount",
    currency: "SAR",
    fmt: "sar_currency",
    join_keys: ["entity_id", "scenario_id"],
    time_col: "ts",
  },
  {
    id: "cod_average_ticket",
    title: "COD Average Ticket",
    formula: "AVG(kpi_cod_avg)",
    unit: "amount",
    currency: "SAR",
    fmt: "sar_currency",
    time_col: "ts",
  },
  {
    id: "cod_conversion_rate",
    title: "COD Conversion Rate",
    formula: "AVG(kpi_cod_rate)",
    unit: "ratio",
    fmt: "percentage",
    time_col: "ts",
  },
  {
    id: "effect_size_confidence",
    title: "Effect Size Confidence",
    formula: "AVG(eff_confidence)",
    unit: "ratio",
    fmt: "percentage",
    time_col: "ts",
  },
];

export const fallbackDimensions: DimensionsCatalog = {
  generated_at: undefined,
  row_count: undefined,
  date: [{ name: "ts" }],
  numeric: [
    { name: "kpi_orders_cnt" },
    { name: "kpi_cod_total" },
    { name: "kpi_cod_avg" },
    { name: "kpi_cod_rate" },
    { name: "eff_confidence" },
  ],
  categorical: [
    { name: "entity_id" },
    { name: "scenario_id" },
    { name: "DESTINATION" },
    { name: "STATUS" },
    { name: "RECEIVER_MODE" },
  ],
  bool: [],
};

export const fallbackInsights: Insight[] = [];

export const fallbackDataset: BiDatasetRow[] = [];
