import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";
import { recomputeSegment } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const stats = await recomputeSegment(id);
    return Response.json({ ok: true, stats });
  } catch (error) {
    return jsonError(error);
  }
}
