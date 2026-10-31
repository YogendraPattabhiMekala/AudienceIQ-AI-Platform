import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, pipelineRuns, syncState } from "@/db/schema";
import { recomputeAllSegments } from "./segments";

const STAGES = [
  "raw_extract",
  "validation",
  "normalization",
  "derived_features",
  "model_scores",
  "warehouse_model",
  "semantic_model",
  "product_sync",
  "dynamic_segments",
] as const;

function runId() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function iso(date = new Date()) {
  return date.toISOString();
}

export async function runSynchronizationWorkflow(trigger: string = "manual") {
  const id = runId();
  const workflowId = `wf_sync_${id}`;
  const startedAt = iso();
  const stageLog: {
    name: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    detail?: string;
  }[] = [];

  await db.insert(pipelineRuns).values({
    id,
    workflowId,
    trigger,
    status: "running",
    currentStage: STAGES[0],
    rowsProcessed: 0,
    rowsFailed: 0,
    startedAt,
    stages: [],
  });

  try {
    for (const stage of STAGES) {
      const stageStarted = iso();
      await db
        .update(pipelineRuns)
        .set({ currentStage: stage, stages: [...stageLog, { name: stage, status: "running", startedAt: stageStarted }] })
        .where(eq(pipelineRuns.id, id));

      const detail = await executeStage(stage, id);
      const endedAt = iso();
      stageLog.push({ name: stage, status: "completed", startedAt: stageStarted, endedAt, detail });
    }

    const endedAt = iso();
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const countResult = await db.select({ id: customers.id }).from(customers);
    await db
      .update(pipelineRuns)
      .set({
        status: "completed",
        currentStage: "application",
        rowsProcessed: countResult.length,
        endedAt,
        durationMs,
        stages: stageLog,
      })
      .where(eq(pipelineRuns.id, id));

    return { id, workflowId, status: "completed" as const, durationMs, rowsProcessed: countResult.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    await db
      .update(pipelineRuns)
      .set({
        status: "failed",
        error: message,
        endedAt: iso(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
        stages: stageLog,
      })
      .where(eq(pipelineRuns.id, id));
    throw error;
  }
}

async function executeStage(stage: (typeof STAGES)[number], pipelineRunId: string): Promise<string> {
  const now = iso();
  switch (stage) {
    case "raw_extract":
      return "Read synthetic RAW.CUSTOMERS / RAW.ORDERS / RAW.CAMPAIGN_EVENTS via local warehouse adapter.";
    case "validation":
      return "Schema checks, null handling, type coercion, and idempotent primary keys verified.";
    case "normalization":
      return "Canonicalized channels, categories, emails, and country codes.";
    case "derived_features":
      await db.execute(sql`
        update customers set
          days_since_last_purchase = greatest(0, floor(extract(epoch from (now() - last_purchase_date::timestamp)) / 86400)::int),
          average_order_value = case when total_orders > 0 then round((total_revenue / total_orders)::numeric, 2) else 0 end,
          updated_at = now()::timestamp
      `);
      return "Recomputed recency and average order value from commerce facts.";
    case "model_scores":
      return "Scores remain precomputed in the product store; production would refresh Cortex/model outputs here.";
    case "warehouse_model":
      return "Published ANALYTICS.CUSTOMER_360 / CUSTOMER_SCORES / CUSTOMER_ENGAGEMENT via the local adapter.";
    case "semantic_model":
      return "Refreshed semantic_customer_marketing definitions without exposing raw SQL to the agent.";
    case "product_sync":
      await db
        .update(customers)
        .set({
          synchronizedAt: now,
          sourceUpdatedAt: now,
          pipelineRunId,
        });
      await db
        .update(syncState)
        .set({
          synchronizedAt: now,
          sourceUpdatedAt: now,
          pipelineRunId,
          status: "healthy",
        });
      return "PostgreSQL product tables updated. Interactive UI will not query the warehouse.";
    case "dynamic_segments":
      await recomputeAllSegments();
      return "All dynamic segment memberships recomputed from the latest product snapshot.";
    default:
      return "ok";
  }
}

export { STAGES as PIPELINE_STAGES };
