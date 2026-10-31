import { desc } from "drizzle-orm";
import { db } from "@/db";
import { pipelineRuns, syncState } from "@/db/schema";
import { formatRelative } from "./format";

export async function getSyncState() {
  const rows = await db.select().from(syncState);
  return rows.map((row) => ({
    ...row,
    freshnessLabel: `${row.label} updated ${formatRelative(row.synchronizedAt)}`,
    lagMinutes: Math.max(
      0,
      Math.round((Date.now() - new Date(row.synchronizedAt).getTime()) / 60000),
    ),
  }));
}

export async function getCustomerFreshness() {
  const rows = await getSyncState();
  const customer = rows.find((row) => row.dataset === "customer_360");
  return customer ?? null;
}

export async function getLatestPipeline() {
  const [run] = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
  return run ?? null;
}

export function demoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export function warehouseAdapterName(): "postgres" | "snowflake" {
  return process.env.WAREHOUSE_ADAPTER === "snowflake" ? "snowflake" : "postgres";
}

export function productDataSourceLabel(): string {
  if (warehouseAdapterName() === "snowflake" && !demoMode()) {
    return "Snowflake semantic layer → PostgreSQL product store";
  }
  return "PostgreSQL product store (local warehouse adapter, synchronized from ANALYTICS.CUSTOMER_360)";
}
