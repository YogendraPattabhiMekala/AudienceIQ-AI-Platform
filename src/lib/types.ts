export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "between"
  | "contains";

export type SemanticFilter = {
  field: string;
  operator: FilterOperator;
  value: string | number | string[] | number[];
};

export type SemanticSort = {
  field: string;
  direction: "asc" | "desc";
};

export type QueryIntent = "list_customers" | "aggregate" | "distribution" | "metric";

export type SemanticQuery = {
  intent: QueryIntent;
  dimensions: string[];
  metrics: string[];
  filters: SemanticFilter[];
  groupBy: string[];
  sort: SemanticSort[];
  limit: number;
};

export type BusinessDefinition = {
  id: string;
  name: string;
  definition: string;
};

export type QueryExplanation = {
  interpretedQuestion: string;
  selectedDimensions: string[];
  selectedMetrics: string[];
  appliedFilters: SemanticFilter[];
  groupBy: string[];
  businessDefinitions: BusinessDefinition[];
  queryRepresentation: string;
  generatedQuery: string;
  dataSource: string;
  warehouseAdapter: string;
  dataFreshness: string;
  synchronizedAt: string | null;
  executionTimeMs: number;
  planner: "deterministic" | "llm";
  warnings: string[];
};

export type SegmentRule = {
  field: string;
  operator: FilterOperator;
  value: string | number | string[] | number[];
};

export type ScoreBand = "low" | "medium" | "high";
