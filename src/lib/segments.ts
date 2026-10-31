import { and, avg, count, eq, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { customers, segmentMemberships, segments, syncState } from "@/db/schema";
import { isAllowedField, isAllowedOperator } from "./catalog";
import { QueryValidationError } from "./query-planner";
import { filterToSql } from "./query-executor";
import type { SegmentRule } from "./types";

export function validateRules(rules: unknown, combinator: unknown): { rules: SegmentRule[]; combinator: "and" | "or" } {
  if (combinator !== "and" && combinator !== "or") {
    throw new QueryValidationError("Segment combinator must be AND or OR");
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new QueryValidationError("A segment requires at least one rule");
  }
  if (rules.length > 20) {
    throw new QueryValidationError("Segments are limited to 20 rules");
  }
  const parsed: SegmentRule[] = rules.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new QueryValidationError(`Rule ${index + 1} is invalid`);
    }
    const rule = item as Record<string, unknown>;
    const field = String(rule.field ?? "");
    const operator = String(rule.operator ?? "");
    if (!isAllowedField(field)) {
      throw new QueryValidationError(`Unauthorized segment field: ${field}`);
    }
    if (!isAllowedOperator(operator)) {
      throw new QueryValidationError(`Unauthorized operator: ${operator}`);
    }
    if (rule.value === undefined || rule.value === null || rule.value === "") {
      throw new QueryValidationError(`Rule ${field} is missing a value`);
    }
    return {
      field,
      operator,
      value: rule.value as SegmentRule["value"],
    };
  });
  return { rules: parsed, combinator };
}

export async function recomputeSegment(segmentId: string) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, segmentId)).limit(1);
  if (!segment) throw new QueryValidationError("Segment not found");

  const { rules, combinator } = validateRules(segment.rules, segment.combinator);
  const clauses = rules.map(filterToSql).filter((clause): clause is NonNullable<typeof clause> => Boolean(clause));
  const where = combinator === "or" ? or(...clauses) : and(...clauses);

  await db.delete(segmentMemberships).where(eq(segmentMemberships.segmentId, segmentId));

  const matching = await db
    .select({
      id: customers.id,
      lifetimeValue: customers.lifetimeValue,
      churnScore: customers.churnScore,
      totalRevenue: customers.totalRevenue,
      campaignEngagementScore: customers.campaignEngagementScore,
    })
    .from(customers)
    .where(where);

  const now = new Date().toISOString();
  const chunkSize = 400;
  for (let i = 0; i < matching.length; i += chunkSize) {
    const slice = matching.slice(i, i + chunkSize);
    if (!slice.length) continue;
    await db.insert(segmentMemberships).values(
      slice.map((row) => ({
        segmentId,
        customerId: row.id,
        computedAt: now,
      })),
    );
  }

  const memberCount = matching.length;
  const averageLtv = memberCount ? matching.reduce((sumValue, row) => sumValue + Number(row.lifetimeValue), 0) / memberCount : 0;
  const averageChurn = memberCount ? matching.reduce((sumValue, row) => sumValue + Number(row.churnScore), 0) / memberCount : 0;
  const totalRevenue = matching.reduce((sumValue, row) => sumValue + Number(row.totalRevenue), 0);
  const averageEngagement = memberCount
    ? matching.reduce((sumValue, row) => sumValue + Number(row.campaignEngagementScore), 0) / memberCount
    : 0;

  await db
    .update(segments)
    .set({
      memberCount,
      averageLtv,
      averageChurn,
      totalRevenue,
      averageEngagement,
      version: segment.version + 1,
      lastComputedAt: now,
      updatedAt: now,
    })
    .where(eq(segments.id, segmentId));

  return {
    id: segmentId,
    memberCount,
    averageLtv,
    averageChurn,
    totalRevenue,
    averageEngagement,
    lastComputedAt: now,
  };
}

export async function recomputeAllSegments() {
  const all = await db.select({ id: segments.id }).from(segments);
  const results = [];
  for (const segment of all) {
    results.push(await recomputeSegment(segment.id));
  }
  await refreshCustomerSegmentNames();
  const now = new Date().toISOString();
  await db
    .update(syncState)
    .set({
      synchronizedAt: now,
      sourceUpdatedAt: now,
      rowCount: all.length,
      status: "healthy",
    })
    .where(eq(syncState.dataset, "customer_segments"));
  return results;
}

export async function refreshCustomerSegmentNames() {
  await db.execute(sql`
    update customers c
    set segment_memberships = coalesce((
      select jsonb_agg(s.name order by s.name)
      from segment_memberships m
      join segments s on s.id = m.segment_id
      where m.customer_id = c.id
    ), '[]'::jsonb)
  `);
}

export async function segmentStats(segmentId: string) {
  const [stats] = await db
    .select({
      members: count(),
      avgLtv: avg(customers.lifetimeValue),
      avgChurn: avg(customers.churnScore),
      revenue: sum(customers.totalRevenue),
      avgEngagement: avg(customers.campaignEngagementScore),
    })
    .from(segmentMemberships)
    .innerJoin(customers, eq(customers.id, segmentMemberships.customerId))
    .where(eq(segmentMemberships.segmentId, segmentId));
  return stats;
}
