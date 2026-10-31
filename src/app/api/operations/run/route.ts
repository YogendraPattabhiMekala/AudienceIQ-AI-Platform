import { jsonError } from "@/lib/http";
import { runSynchronizationWorkflow } from "@/lib/pipeline";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await ensureSeeded();
    const result = await runSynchronizationWorkflow("manual");
    return Response.json({ ok: true, result });
  } catch (error) {
    return jsonError(error);
  }
}
