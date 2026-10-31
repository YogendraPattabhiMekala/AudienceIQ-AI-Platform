import { getLatestPipeline, getSyncState, productDataSourceLabel, warehouseAdapterName } from "@/lib/freshness";
import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const [sync, pipeline] = await Promise.all([getSyncState(), getLatestPipeline()]);
    return Response.json({
      ok: true,
      sync,
      pipeline,
      dataSource: productDataSourceLabel(),
      adapter: warehouseAdapterName(),
      demoMode: process.env.DEMO_MODE !== "false",
    });
  } catch (error) {
    return jsonError(error);
  }
}
