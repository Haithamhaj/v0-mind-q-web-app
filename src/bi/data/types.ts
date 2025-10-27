import type { Layer3Intelligence } from "./intelligence";

export type MetricSpec = {
  id: string;
  title?: string;
  formula?: string;
  unit?: string;
  currency?: string;
  fmt?: string;
  join_keys?: string[];
  time_col?: string | null;
};

export type DimensionSpec = {
  name: string;
  dtype?: string;
  non_null?: number;
  cardinality?: number;
};

export type DimensionsCatalog = {
  generated_at?: string;
  row_count?: number;
  date: DimensionSpec[];
  numeric: DimensionSpec[];
  categorical: DimensionSpec[];
  bool: DimensionSpec[];
};

export type InsightDriver = {
  dimension: string;
  value: string;
  impact?: number | null;
};

export type Insight = {
  id: string;
  type: string;
  kpi?: string;
  title: string;
  summary?: string;
  severity?: string;
  delta?: number | null;
  delta_type?: string;
  timestamp?: string | null;
  drivers?: InsightDriver[];
  source?: string;
  recommendations?: string[];
  next_steps?: string[];
  metrics_context?: Record<string, unknown>;
  tags?: string[];
  deltas?: Record<string, number>;
  delta_descriptions?: Record<
    string,
    {
      value?: number | null;
      formatted?: string | null;
      movement?: string | null;
    }
  >;
};

export type BiDatasetRow = Record<string, unknown>;

export type CorrelationPair = {
  feature_a: string;
  feature_b: string;
  correlation?: number | null;
  abs_correlation?: number | null;
  sample_size?: number | null;
  kind?: string;
  method?: string;
  source?: string | null;
  p_value?: number | null;
  feature_a_label?: string;
  feature_b_label?: string;
  feature_a_domain?: string;
  feature_b_domain?: string;
  feature_a_sensitivity?: string;
  feature_b_sensitivity?: string;
  feature_a_description?: string;
  feature_b_description?: string;
  business_label?: string;
  impact_summary?: string;
  sensitivity?: string;
  kpi_tag?: string | null;
  kpi_label?: string | null;
  kpi_direction?: string | null;
  kpi_unit?: string | null;
  kpi_feature?: string | null;
  impact_driver_feature?: string | null;
  impact_driver_label?: string | null;
  effect_direction?: string | null;
  effect_is_positive?: boolean | null;
  expected_kpi_delta?: number | null;
  expected_kpi_delta_pct?: number | null;
  driver_domain?: string | null;
  is_persistent?: boolean;
  history_runs?: string[];
};

export type BusinessCorrelation = {
  feature_a: string;
  feature_b: string;
  correlation?: number | null;
  abs_correlation?: number | null;
  sample_size?: number | null;
  method?: string;
  kind?: string;
  notes?: Record<string, unknown>;
  p_value?: number | null;
  feature_a_label?: string;
  feature_b_label?: string;
  feature_a_domain?: string;
  feature_b_domain?: string;
  feature_a_sensitivity?: string;
  feature_b_sensitivity?: string;
  feature_a_description?: string;
  feature_b_description?: string;
  business_label?: string;
  impact_summary?: string;
  sensitivity?: string;
  kpi_tag?: string | null;
  kpi_label?: string | null;
  kpi_direction?: string | null;
  kpi_unit?: string | null;
  kpi_feature?: string | null;
  impact_driver_feature?: string | null;
  impact_driver_label?: string | null;
  effect_direction?: string | null;
  effect_is_positive?: boolean | null;
  expected_kpi_delta?: number | null;
  expected_kpi_delta_pct?: number | null;
  driver_domain?: string | null;
  is_persistent?: boolean;
  history_runs?: string[];
};

export type BusinessCorrelationGroups = {
  numeric_numeric: BusinessCorrelation[];
  numeric_categorical: BusinessCorrelation[];
  categorical_categorical: BusinessCorrelation[];
};

export type CorrelationCollection = {
  numeric: CorrelationPair[];
  datetime: CorrelationPair[];
  business: BusinessCorrelationGroups | null;
  sources?: {
    numeric?: string | null;
    datetime?: string | null;
    business?: string | null;
  };
  run?: string | null;
  artifacts_root?: string | null;
  top?: number | null;
};

export type InsightStats = {
  insights_total?: number;
  by_type?: Record<string, number>;
};

export type CatalogMetadata = {
  metrics?: Record<string, unknown>;
  dimensions?: Record<string, unknown>;
  insights?: Record<string, unknown>;
};

export type BiDataContextValue = {
  metrics: MetricSpec[];
  dimensions: DimensionsCatalog;
  insights: Insight[];
  dataset: BiDatasetRow[];
  correlations: CorrelationCollection;
  intelligence: Layer3Intelligence;
  loading: boolean;
  error?: string;
  filters: Record<string, string[]>;
  setFilter: (dimension: string, values: string[]) => void;
  insightStats?: InsightStats;
  catalogMeta: CatalogMetadata;
};

