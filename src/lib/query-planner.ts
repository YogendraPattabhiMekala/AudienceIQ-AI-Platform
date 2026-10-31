import { catalog, getField, isAllowedField, isAllowedOperator, SQL_COLUMN_BY_FIELD } from "./catalog";
import type { FilterOperator, QueryIntent, SemanticFilter, SemanticQuery, SemanticSort } from "./types";

const DESTRUCTIVE = /\b(drop|delete|truncate|alter|insert|update|grant|revoke|copy|execute|pg_sleep|information_schema)\b/i;
const SQL_META = /(--|\/\*|\*\/|;|\bunion\b|\bselect\b|\bfrom\b)/i;

export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}

function assertSafeLiteral(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (DESTRUCTIVE.test(value) || (SQL_META.test(value) && value.length > 40)) {
      throw new QueryValidationError(`Rejected potentially unsafe value at ${path}`);
    }
    if (value.length > 200) {
      throw new QueryValidationError(`Value too long at ${path}`);
    }
  }
}

export function validateSemanticQuery(input: unknown): SemanticQuery {
  if (!input || typeof input !== "object") {
    throw new QueryValidationError("Query plan must be an object");
  }
  const raw = input as Record<string, unknown>;

  const intent = (raw.intent as QueryIntent) ?? "list_customers";
  if (!["list_customers", "aggregate", "distribution", "metric"].includes(intent)) {
    throw new QueryValidationError(`Unsupported intent: ${String(raw.intent)}`);
  }

  const dimensions = Array.isArray(raw.dimensions) ? raw.dimensions.map(String) : [];
  const metrics = Array.isArray(raw.metrics) ? raw.metrics.map(String) : [];
  const groupBy = Array.isArray(raw.groupBy)
    ? raw.groupBy.map(String)
    : Array.isArray(raw.group_by)
      ? (raw.group_by as unknown[]).map(String)
      : [];

  for (const name of [...dimensions, ...metrics, ...groupBy]) {
    if (name === "customer_count") continue;
    if (!isAllowedField(name)) {
      throw new QueryValidationError(`Field is not in the semantic allow-list: ${name}`);
    }
  }

  const filtersRaw = Array.isArray(raw.filters) ? raw.filters : [];
  if (filtersRaw.length > catalog.limits.maxFilters) {
    throw new QueryValidationError(`Too many filters (max ${catalog.limits.maxFilters})`);
  }

  const filters: SemanticFilter[] = filtersRaw.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new QueryValidationError(`Filter ${index} is invalid`);
    }
    const filter = item as Record<string, unknown>;
    const field = String(filter.field ?? "");
    const operator = String(filter.operator ?? "") as FilterOperator;
    if (!isAllowedField(field)) {
      throw new QueryValidationError(`Unauthorized filter field: ${field}`);
    }
    if (!isAllowedOperator(operator)) {
      throw new QueryValidationError(`Operator not allowed: ${operator}`);
    }
    const value = filter.value as SemanticFilter["value"];
    if (value === undefined || value === null || value === "") {
      throw new QueryValidationError(`Filter ${field} is missing a value`);
    }
    assertSafeLiteral(value, `filters[${index}].value`);
    if (Array.isArray(value)) {
      if (value.length > 50) {
        throw new QueryValidationError("IN / BETWEEN lists are limited to 50 values");
      }
      value.forEach((entry, inner) => assertSafeLiteral(entry, `filters[${index}].value[${inner}]`));
      if (operator === "between" && value.length !== 2) {
        throw new QueryValidationError("BETWEEN requires exactly two values");
      }
    }
    const fieldMeta = getField(field);
    if (fieldMeta?.type === "number" && operator !== "in" && operator !== "contains" && !Array.isArray(value)) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
          throw new QueryValidationError(`Filter ${field} expects a numeric value`);
        }
        return { field, operator, value: numeric };
      }
    }
    return { field, operator, value };
  });

  const sortRaw = Array.isArray(raw.sort) ? raw.sort : [];
  const sort: SemanticSort[] = sortRaw.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new QueryValidationError(`Sort ${index} is invalid`);
    }
    const entry = item as Record<string, unknown>;
    const field = String(entry.field ?? "");
    if (field !== "customer_count" && !isAllowedField(field)) {
      throw new QueryValidationError(`Unauthorized sort field: ${field}`);
    }
    const direction = entry.direction === "asc" ? "asc" : "desc";
    return { field, direction };
  });

  let limit = Number(raw.limit ?? catalog.limits.defaultRows);
  if (!Number.isFinite(limit) || limit <= 0) limit = catalog.limits.defaultRows;
  limit = Math.min(Math.floor(limit), catalog.limits.maxRows);

  if (intent === "aggregate" && groupBy.length === 0 && metrics.length === 0) {
    throw new QueryValidationError("Aggregate queries require group_by or metrics");
  }

  return {
    intent,
    dimensions,
    metrics: metrics.length ? metrics : intent === "list_customers" ? [] : ["customer_count"],
    filters,
    groupBy,
    sort,
    limit,
  };
}

export function humanQuery(plan: SemanticQuery): string {
  const parts = ["Customers"];
  if (plan.filters.length) {
    parts.push(
      "WHERE " +
        plan.filters
          .map((filter) => {
            const rendered = Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value);
            return `${filter.field} ${filter.operator} ${rendered}`;
          })
          .join(" AND "),
    );
  }
  if (plan.groupBy.length) parts.push("GROUP BY " + plan.groupBy.join(", "));
  if (plan.metrics.length) parts.push("METRICS " + plan.metrics.join(", "));
  if (plan.sort.length) {
    parts.push("ORDER BY " + plan.sort.map((item) => `${item.field} ${item.direction}`).join(", "));
  }
  parts.push(`LIMIT ${plan.limit}`);
  return parts.join(" ");
}

export function explainSql(plan: SemanticQuery): string {
  const selectCols =
    plan.intent === "aggregate" || plan.intent === "metric"
      ? [
          ...plan.groupBy.map((field) => sqlIdent(field)),
          ...plan.metrics.map((metric) => {
            if (metric === "customer_count") return "COUNT(*) AS customer_count";
            const ident = sqlIdent(metric);
            const agg = getField(metric)?.aggregation ?? "avg";
            return `${agg.toUpperCase()}(${ident}) AS ${ident}`;
          }),
        ].join(", ")
      : "id, first_name, last_name, email, city, state, acquisition_channel, customer_status, favorite_category, lifetime_value, churn_score, purchase_propensity_score, campaign_engagement_score, days_since_last_purchase";

  const where = plan.filters.length
    ? " WHERE " +
      plan.filters
        .map((filter, index) => {
          const col = sqlIdent(filter.field);
          const param = `$${index + 1}`;
          switch (filter.operator) {
            case "eq":
              return `${col} = ${param}`;
            case "neq":
              return `${col} <> ${param}`;
            case "gt":
              return `${col} > ${param}`;
            case "gte":
              return `${col} >= ${param}`;
            case "lt":
              return `${col} < ${param}`;
            case "lte":
              return `${col} <= ${param}`;
            case "contains":
              return `${col} ILIKE ${param}`;
            case "in":
              return `${col} = ANY(${param})`;
            case "between":
              return `${col} BETWEEN ${param} AND $${index + 1}b`;
            default:
              return "FALSE";
          }
        })
        .join(" AND ")
    : "";

  const group = plan.groupBy.length ? " GROUP BY " + plan.groupBy.map(sqlIdent).join(", ") : "";
  const order = plan.sort.length
    ? " ORDER BY " + plan.sort.map((item) => `${sqlIdent(item.field)} ${item.direction.toUpperCase()}`).join(", ")
    : "";
  return `SELECT ${selectCols} FROM customers${where}${group}${order} LIMIT ${plan.limit}`;
}

function sqlIdent(field: string): string {
  if (field === "customer_count") return "customer_count";
  const column = SQL_COLUMN_BY_FIELD[field];
  if (!column) {
    throw new QueryValidationError(`Cannot project unauthorized field ${field}`);
  }
  return column;
}

export const FORBIDDEN_SQL_PATTERNS = DESTRUCTIVE;
