import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resultRows } from "./result-rows";

const METRICS = {
  churn_score: { column: "churn_score", label: "Churn score", min: 0, max: 1, high: 0.7, mid: 0.4 },
  lifetime_value: { column: "lifetime_value", label: "Lifetime value", min: 0, max: 6000, high: 1000, mid: 400 },
  purchase_propensity_score: {
    column: "purchase_propensity_score",
    label: "Purchase propensity",
    min: 0,
    max: 1,
    high: 0.65,
    mid: 0.4,
  },
  product_fit_score: { column: "product_fit_score", label: "Product fit", min: 0, max: 1, high: 0.65, mid: 0.4 },
} as const;

export type ScoreMetric = keyof typeof METRICS;

export function isScoreMetric(value: string): value is ScoreMetric {
  return value in METRICS;
}

export async function scoreDistribution(metric: ScoreMetric) {
  const meta = METRICS[metric];
  const stats = await db.execute(sql`
    select
      avg(${sql.raw(meta.column)})::float as avg,
      percentile_cont(0.5) within group (order by ${sql.raw(meta.column)})::float as median,
      min(${sql.raw(meta.column)})::float as min,
      max(${sql.raw(meta.column)})::float as max,
      percentile_cont(0.25) within group (order by ${sql.raw(meta.column)})::float as p25,
      percentile_cont(0.75) within group (order by ${sql.raw(meta.column)})::float as p75,
      percentile_cont(0.90) within group (order by ${sql.raw(meta.column)})::float as p90,
      count(*)::int as n,
      count(*) filter (where ${sql.raw(meta.column)} >= ${sql.raw(String(meta.high))})::int as high_n,
      count(*) filter (where ${sql.raw(meta.column)} >= ${sql.raw(String(meta.mid))} and ${sql.raw(meta.column)} < ${sql.raw(String(meta.high))})::int as mid_n,
      count(*) filter (where ${sql.raw(meta.column)} < ${sql.raw(String(meta.mid))})::int as low_n
    from customers
  `);

  const buckets = await db.execute(sql`
    select width_bucket(${sql.raw(meta.column)}, ${sql.raw(String(meta.min))}, ${sql.raw(String(meta.max))}, 16) as bucket,
           count(*)::int as count,
           min(${sql.raw(meta.column)})::float as bin_min,
           max(${sql.raw(meta.column)})::float as bin_max
    from customers
    group by 1
    order by 1
  `);

  const byChannel = await db.execute(sql`
    select acquisition_channel as label,
           avg(${sql.raw(meta.column)})::float as value,
           count(*)::int as customers
    from customers
    group by 1
    order by 2 desc
  `);

  const byStatus = await db.execute(sql`
    select customer_status as label,
           avg(${sql.raw(meta.column)})::float as value,
           count(*)::int as customers
    from customers
    group by 1
    order by 2 desc
  `);

  const row = resultRows<{
    avg: number;
    median: number;
    min: number;
    max: number;
    p25: number;
    p75: number;
    p90: number;
    n: number;
    high_n: number;
    mid_n: number;
    low_n: number;
  }>(stats)[0] ?? {
    avg: 0,
    median: 0,
    min: 0,
    max: 0,
    p25: 0,
    p75: 0,
    p90: 0,
    n: 0,
    high_n: 0,
    mid_n: 0,
    low_n: 0,
  };

  return {
    metric,
    label: meta.label,
    thresholds: { high: meta.high, mid: meta.mid },
    stats: {
      avg: Number(row.avg),
      median: Number(row.median),
      min: Number(row.min),
      max: Number(row.max),
      p25: Number(row.p25),
      p75: Number(row.p75),
      p90: Number(row.p90),
      n: Number(row.n),
    },
    bands: {
      high: Number(row.high_n),
      medium: Number(row.mid_n),
      low: Number(row.low_n),
    },
    histogram: resultRows<{ bucket: number; count: number; bin_min: number; bin_max: number }>(buckets)
      .filter((item) => item.bucket > 0)
      .map((item) => ({
        label: Number(item.bin_min).toFixed(metric === "lifetime_value" ? 0 : 2),
        value: item.count,
      })),
    byChannel: resultRows<{ label: string; value: number; customers: number }>(byChannel),
    byStatus: resultRows<{ label: string; value: number; customers: number }>(byStatus),
  };
}

export const SCORE_METRICS = METRICS;
