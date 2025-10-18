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
};

export type BiDatasetRow = Record<string, unknown>;

export type CorrelationPair = {
  feature_a: string;
  feature_b: string;
  correlation?: number | null;
  abs_correlation?: number | null;
  sample_size?: number | null;
  kind: "numeric" | "datetime";
  source?: string | null;
};

export type CorrelationCollection = {
  numeric: CorrelationPair[];
  datetime: CorrelationPair[];
  sources?: {
    numeric?: string | null;
    datetime?: string | null;
  };
};

export type BiDataContextValue = {
  metrics: MetricSpec[];
  dimensions: DimensionsCatalog;
  insights: Insight[];
  dataset: BiDatasetRow[];
  correlations: CorrelationCollection;
  loading: boolean;
  error?: string;
  filters: Record<string, string[]>;
  setFilter: (dimension: string, values: string[]) => void;
};
