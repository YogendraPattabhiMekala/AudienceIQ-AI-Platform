import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lt, lte, ne, or, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { catalog, CUSTOMER_COLUMN_BY_FIELD, getField } from "./catalog";
import { explainSql, humanQuery, QueryValidationError, validateSemanticQuery } from "./query-planner";
import type { SemanticFilter, SemanticQuery } from "./types";

const COLUMN = {
  id: customers.id,
  firstName: customers.firstName,
  lastName: customers.lastName,
  email: customers.email,
  age: customers.age,
  city: customers.city,
  state: customers.state,
  country: customers.country,
  signupDate: customers.signupDate,
  acquisitionChannel: customers.acquisitionChannel,
  customerStatus: customers.customerStatus,
  favoriteCategory: customers.favoriteCategory,
  preferredChannel: customers.preferredChannel,
  lastPurchaseDate: customers.lastPurchaseDate,
  lastCampaignEngagement: customers.lastCampaignEngagement,
  totalOrders: customers.totalOrders,
  totalRevenue: customers.totalRevenue,
  averageOrderValue: customers.averageOrderValue,
  lifetimeValue: customers.lifetimeValue,
  daysSinceLastPurchase: customers.daysSinceLastPurchase,
  churnScore: customers.churnScore,
  purchasePropensityScore: customers.purchasePropensityScore,
  productFitScore: customers.productFitScore,
  campaignEngagementScore: customers.campaignEngagementScore,
  emailOpenRate: customers.emailOpenRate,
  emailClickRate: customers.emailClickRate,
} as const;

type ColumnKey = keyof typeof COLUMN;

function drizzleColumn(field: string) {
  const key = CUSTOMER_COLUMN_BY_FIELD[field] as ColumnKey | undefined;
  if (!key || !(key in COLUMN)) {
    throw new QueryValidationError(`Cannot bind unauthorized field ${field}`);
  }
  return COLUMN[key];
}

export function filterToSql(filter: SemanticFilter): SQL | undefined {
  const column = drizzleColumn(filter.field);
  const value = filter.value;
  switch (filter.operator) {
    case "eq":
      return eq(column, value as never);
    case "neq":
      return ne(column, value as never);
    case "gt":
      return gt(column, value as never);
    case "gte":
      return gte(column, value as never);
    case "lt":
      return lt(column, value as never);
    case "lte":
      return lte(column, value as never);
    case "contains":
      return ilike(column, `%${String(value)}%`);
    case "in":
      return inArray(column, (Array.isArray(value) ? value : [value]) as never);
    case "between": {
      const [start, end] = Array.isArray(value) ? value : [value, value];
      return and(gte(column, start as never), lte(column, end as never));
    }
    default:
      throw new QueryValidationError(`Operator not executable: ${filter.operator}`);
  }
}

export function filtersToWhere(filters: SemanticFilter[], combinator: "and" | "or" = "and") {
  const clauses = filters.map(filterToSql).filter(Boolean) as SQL[];
  if (!clauses.length) return undefined;
  return combinator === "or" ? or(...clauses) : and(...clauses);
}

export async function executeSemanticQuery(input: unknown) {
  const plan = validateSemanticQuery(input);
  const started = Date.now();
  const where = filtersToWhere(plan.filters);

  if (plan.intent === "aggregate" || plan.intent === "metric") {
    const aggregations = buildAggregations(plan);
    const groupCols = plan.groupBy.map((field) => drizzleColumn(field));
    const selectShape = {
      ...Object.fromEntries(plan.groupBy.map((field) => [field, drizzleColumn(field)])),
      ...aggregations,
    };
    const base = db.select(selectShape).from(customers).where(where);
    const rows = await withTimeout(
      (groupCols.length ? base.groupBy(...groupCols) : base).limit(plan.limit),
    );
    return {
      plan,
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - started,
      representation: humanQuery(plan),
      generatedQuery: explainSql(plan),
    };
  }

  const orderBy = plan.sort.length
    ? plan.sort.map((item) => {
        const col = item.field === "customer_count" ? customers.lifetimeValue : drizzleColumn(item.field);
        return item.direction === "asc" ? asc(col) : desc(col);
      })
    : [desc(customers.lifetimeValue)];

  const rows = await withTimeout(
    db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        city: customers.city,
        state: customers.state,
        acquisitionChannel: customers.acquisitionChannel,
        customerStatus: customers.customerStatus,
        favoriteCategory: customers.favoriteCategory,
        lifetimeValue: customers.lifetimeValue,
        churnScore: customers.churnScore,
        purchasePropensityScore: customers.purchasePropensityScore,
        productFitScore: customers.productFitScore,
        campaignEngagementScore: customers.campaignEngagementScore,
        daysSinceLastPurchase: customers.daysSinceLastPurchase,
        totalRevenue: customers.totalRevenue,
        emailOpenRate: customers.emailOpenRate,
      })
      .from(customers)
      .where(where)
      .orderBy(...orderBy)
      .limit(plan.limit),
  );

  return {
    plan,
    rows,
    rowCount: rows.length,
    executionTimeMs: Date.now() - started,
    representation: humanQuery(plan),
    generatedQuery: explainSql(plan),
  };
}

function buildAggregations(plan: SemanticQuery) {
  const result: Record<string, SQL | ReturnType<typeof count>> = {};
  const metrics = plan.metrics.length ? plan.metrics : ["customer_count"];
  for (const metric of metrics) {
    if (metric === "customer_count") {
      result.customer_count = count();
      continue;
    }
    const column = drizzleColumn(metric);
    const agg = getField(metric)?.aggregation ?? "avg";
    if (agg === "sum") result[metric] = sql<number>`sum(${column})::float`;
    else if (agg === "min") result[metric] = sql<number>`min(${column})::float`;
    else if (agg === "max") result[metric] = sql<number>`max(${column})::float`;
    else result[metric] = sql<number>`avg(${column})::float`;
  }
  return result;
}

async function withTimeout<T>(promise: Promise<T> | T): Promise<T> {
  const run = Promise.resolve(promise);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new QueryValidationError("Query exceeded the governed timeout")),
      catalog.limits.timeoutMs,
    );
  });
  try {
    return await Promise.race([run, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
