import catalogJson from "../../data/semantic/catalog.json";
import type { FilterOperator } from "./types";

export type CatalogField = {
  name: string;
  column?: string;
  type: string;
  description: string;
  aggregation?: string;
  definitionId?: string;
};

export type CatalogDefinition = {
  id: string;
  name: string;
  definition: string;
  threshold?: Record<string, number>;
};

export type SemanticCatalog = {
  version: string;
  name: string;
  description: string;
  source: {
    product: string;
    warehouse: string;
    semanticView: string;
  };
  limits: {
    maxRows: number;
    defaultRows: number;
    timeoutMs: number;
    maxFilters: number;
  };
  operators: FilterOperator[];
  aggregations: string[];
  dimensions: CatalogField[];
  metrics: CatalogField[];
  definitions: CatalogDefinition[];
};

export const catalog = catalogJson as SemanticCatalog;

const dimensionByName = new Map(catalog.dimensions.map((field) => [field.name, field]));
const metricByName = new Map(catalog.metrics.map((field) => [field.name, field]));
const definitionById = new Map(catalog.definitions.map((item) => [item.id, item]));

export const ALLOWED_OPERATORS = new Set(catalog.operators);

export function getDimension(name: string): CatalogField | undefined {
  return dimensionByName.get(name);
}

export function getMetric(name: string): CatalogField | undefined {
  return metricByName.get(name);
}

export function getField(name: string): CatalogField | undefined {
  return dimensionByName.get(name) ?? metricByName.get(name);
}

export function getDefinition(id: string): CatalogDefinition | undefined {
  return definitionById.get(id);
}

export function isAllowedField(name: string): boolean {
  return dimensionByName.has(name) || metricByName.has(name);
}

export function isAllowedOperator(op: string): op is FilterOperator {
  return ALLOWED_OPERATORS.has(op as FilterOperator);
}

export function definitionsForFields(fields: string[]): CatalogDefinition[] {
  const seen = new Set<string>();
  const result: CatalogDefinition[] = [];
  for (const fieldName of fields) {
    const field = getField(fieldName);
    if (field?.definitionId) {
      const definition = getDefinition(field.definitionId);
      if (definition && !seen.has(definition.id)) {
        seen.add(definition.id);
        result.push(definition);
      }
    }
  }
  for (const extra of ["high_value_churn_risk", "active_customer"]) {
    const definition = getDefinition(extra);
    if (definition && !seen.has(definition.id) && fields.includes("lifetime_value") && fields.includes("churn_score")) {
      seen.add(definition.id);
      result.push(definition);
    }
  }
  return result;
}

export const CUSTOMER_COLUMN_BY_FIELD: Record<string, string> = {
  customer_id: "id",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  age: "age",
  city: "city",
  state: "state",
  country: "country",
  signup_date: "signupDate",
  acquisition_channel: "acquisitionChannel",
  customer_status: "customerStatus",
  favorite_category: "favoriteCategory",
  preferred_channel: "preferredChannel",
  last_purchase_date: "lastPurchaseDate",
  last_campaign_engagement: "lastCampaignEngagement",
  total_orders: "totalOrders",
  total_revenue: "totalRevenue",
  average_order_value: "averageOrderValue",
  lifetime_value: "lifetimeValue",
  days_since_last_purchase: "daysSinceLastPurchase",
  churn_score: "churnScore",
  purchase_propensity_score: "purchasePropensityScore",
  product_fit_score: "productFitScore",
  campaign_engagement_score: "campaignEngagementScore",
  email_open_rate: "emailOpenRate",
  email_click_rate: "emailClickRate",
};

export const SQL_COLUMN_BY_FIELD: Record<string, string> = {
  customer_id: "id",
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  age: "age",
  city: "city",
  state: "state",
  country: "country",
  signup_date: "signup_date",
  acquisition_channel: "acquisition_channel",
  customer_status: "customer_status",
  favorite_category: "favorite_category",
  preferred_channel: "preferred_channel",
  last_purchase_date: "last_purchase_date",
  last_campaign_engagement: "last_campaign_engagement",
  total_orders: "total_orders",
  total_revenue: "total_revenue",
  average_order_value: "average_order_value",
  lifetime_value: "lifetime_value",
  days_since_last_purchase: "days_since_last_purchase",
  churn_score: "churn_score",
  purchase_propensity_score: "purchase_propensity_score",
  product_fit_score: "product_fit_score",
  campaign_engagement_score: "campaign_engagement_score",
  email_open_rate: "email_open_rate",
  email_click_rate: "email_click_rate",
};

export const LIST_FIELDS = [
  "customer_id",
  "first_name",
  "last_name",
  "email",
  "city",
  "state",
  "acquisition_channel",
  "customer_status",
  "favorite_category",
  "lifetime_value",
  "churn_score",
  "purchase_propensity_score",
  "campaign_engagement_score",
  "days_since_last_purchase",
] as const;
