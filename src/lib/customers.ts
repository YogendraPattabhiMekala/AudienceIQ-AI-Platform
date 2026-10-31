import { and, asc, count, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import { campaignEvents, customers, orders, segmentMemberships, segments } from "@/db/schema";
import { filtersToWhere } from "./query-executor";
import { QueryValidationError, validateSemanticQuery } from "./query-planner";
import { resultRows } from "./result-rows";
import type { SemanticFilter } from "./types";

const SORTABLE: Record<string, typeof customers.lifetimeValue | typeof customers.churnScore | typeof customers.lastName | typeof customers.daysSinceLastPurchase | typeof customers.totalOrders | typeof customers.email | typeof customers.purchasePropensityScore | typeof customers.campaignEngagementScore | typeof customers.totalRevenue | typeof customers.age> = {
  lifetimeValue: customers.lifetimeValue,
  lifetime_value: customers.lifetimeValue,
  churnScore: customers.churnScore,
  churn_score: customers.churnScore,
  lastName: customers.lastName,
  daysSinceLastPurchase: customers.daysSinceLastPurchase,
  days_since_last_purchase: customers.daysSinceLastPurchase,
  totalOrders: customers.totalOrders,
  email: customers.email,
  purchasePropensityScore: customers.purchasePropensityScore,
  campaignEngagementScore: customers.campaignEngagementScore,
  totalRevenue: customers.totalRevenue,
  age: customers.age,
};

export async function listCustomers(input: {
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  filters?: SemanticFilter[];
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));
  const filters = input.filters ?? [];
  if (filters.length) {
    validateSemanticQuery({ intent: "list_customers", filters, limit: pageSize });
  }

  const clauses: SQL[] = [];
  const filterWhere = filtersToWhere(filters);
  if (filterWhere) clauses.push(filterWhere);

  if (input.search?.trim()) {
    const term = `%${input.search.trim()}%`;
    const searchClause = or(
      ilike(customers.firstName, term),
      ilike(customers.lastName, term),
      ilike(customers.email, term),
      ilike(customers.id, term),
      ilike(customers.city, term),
      ilike(customers.state, term),
    );
    if (searchClause) clauses.push(searchClause);
  }

  const where = clauses.length ? and(...clauses) : undefined;
  const sortCol = SORTABLE[input.sort ?? "lifetimeValue"] ?? customers.lifetimeValue;
  const order = input.dir === "asc" ? asc(sortCol) : desc(sortCol);

  const [countRow] = await db.select({ total: count() }).from(customers).where(where);
  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(order, asc(customers.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows,
    total: Number(countRow.total),
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(Number(countRow.total) / pageSize)),
  };
}

export async function getCustomer(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;
  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.orderDate))
    .limit(8);
  const events = await db
    .select()
    .from(campaignEvents)
    .where(eq(campaignEvents.customerId, id))
    .orderBy(desc(campaignEvents.eventAt))
    .limit(8);
  const memberships = await db
    .select({
      id: segments.id,
      name: segments.name,
      memberCount: segments.memberCount,
    })
    .from(segmentMemberships)
    .innerJoin(segments, eq(segments.id, segmentMemberships.segmentId))
    .where(eq(segmentMemberships.customerId, id));
  return { customer, orders: recentOrders, events, segments: memberships };
}

export function parseFiltersParam(raw: string | null): SemanticFilter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new QueryValidationError("filters must be an array");
    return validateSemanticQuery({ intent: "list_customers", filters: parsed, limit: 25 }).filters;
  } catch (error) {
    if (error instanceof QueryValidationError) throw error;
    throw new QueryValidationError("filters must be valid JSON");
  }
}

export async function dashboardMetrics() {
  const [row] = await db
    .select({
      totalCustomers: count(),
      activeCustomers: sql<number>`count(*) filter (where customer_status in ('active','at_risk') and days_since_last_purchase <= 90)`,
      averageLtv: sql<number>`avg(lifetime_value)`,
      highChurn: sql<number>`count(*) filter (where churn_score > 0.70)`,
      revenue: sql<number>`sum(total_revenue)`,
      engagement: sql<number>`avg(campaign_engagement_score)`,
      avgChurn: sql<number>`avg(churn_score)`,
      avgPropensity: sql<number>`avg(purchase_propensity_score)`,
    })
    .from(customers);

  const byChannel = await db
    .select({
      label: customers.acquisitionChannel,
      customers: count(),
      ltv: sql<number>`avg(lifetime_value)`,
      revenue: sql<number>`sum(total_revenue)`,
    })
    .from(customers)
    .groupBy(customers.acquisitionChannel)
    .orderBy(desc(sql`avg(lifetime_value)`));

  const byStatus = await db
    .select({
      label: customers.customerStatus,
      customers: count(),
    })
    .from(customers)
    .groupBy(customers.customerStatus);

  const byCategory = await db
    .select({
      label: customers.favoriteCategory,
      revenue: sql<number>`sum(total_revenue)`,
      customers: count(),
    })
    .from(customers)
    .groupBy(customers.favoriteCategory)
    .orderBy(desc(sql`sum(total_revenue)`));

  const churnBuckets = await db.execute(sql`
    select width_bucket(churn_score, 0, 1, 12) as bucket, count(*)::int as count
    from customers
    group by 1
    order by 1
  `);

  return {
    totals: {
      totalCustomers: Number(row.totalCustomers),
      activeCustomers: Number(row.activeCustomers),
      averageLtv: Number(row.averageLtv ?? 0),
      highChurn: Number(row.highChurn),
      revenue: Number(row.revenue ?? 0),
      engagement: Number(row.engagement ?? 0),
      avgChurn: Number(row.avgChurn ?? 0),
      avgPropensity: Number(row.avgPropensity ?? 0),
    },
    byChannel,
    byStatus,
    byCategory,
    churnBuckets: resultRows<{ bucket: number; count: number }>(churnBuckets).map((item) => ({
      label: `${Math.max(0, item.bucket - 1) / 12}`,
      value: item.count,
    })),
  };
}
