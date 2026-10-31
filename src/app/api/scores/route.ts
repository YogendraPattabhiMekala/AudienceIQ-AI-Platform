import { jsonError } from "@/lib/http";
import { QueryValidationError } from "@/lib/query-planner";
import { isScoreMetric, scoreDistribution } from "@/lib/scores";
import { ensureSeeded } from "@/lib/seed";
import { getSyncState } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const metric = new URL(request.url).searchParams.get("metric") ?? "churn_score";
    if (!isScoreMetric(metric)) {
      throw new QueryValidationError("Unknown score metric");
    }
    const [distribution, sync] = await Promise.all([scoreDistribution(metric), getSyncState()]);
    return Response.json({ ok: true, distribution, sync });
  } catch (error) {
    return jsonError(error);
  }
}
