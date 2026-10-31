import { desc } from "drizzle-orm";
import { db } from "@/db";
import { aiQueryLogs, pipelineRuns } from "@/db/schema";
import { getSyncState, productDataSourceLabel, warehouseAdapterName } from "@/lib/freshness";
import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const [runs, sync, asks] = await Promise.all([
      db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(12),
      getSyncState(),
      db.select().from(aiQueryLogs).orderBy(desc(aiQueryLogs.createdAt)).limit(8),
    ]);
    return Response.json({
      ok: true,
      runs,
      sync,
      asks,
      dataSource: productDataSourceLabel(),
      adapter: warehouseAdapterName(),
      zeroNote:
        "Client sync uses request/response against the PostgreSQL product store. Zero would replace this with incremental client replication; see docs/DESIGN.md.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
