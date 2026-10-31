import { dashboardMetrics } from "@/lib/customers";
import { getLatestPipeline, getSyncState } from "@/lib/freshness";
import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const [metrics, sync, pipeline, segmentCount] = await Promise.all([
      dashboardMetrics(),
      getSyncState(),
      getLatestPipeline(),
      db.select({ c: count() }).from(segments),
    ]);
    return Response.json({
      ok: true,
      metrics,
      sync,
      pipeline,
      activeSegments: Number(segmentCount[0]?.c ?? 0),
    });
  } catch (error) {
    return jsonError(error);
  }
}
