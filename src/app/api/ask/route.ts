import { askAudienceIq } from "@/lib/agent";
import { jsonError, rateLimit } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    rateLimit(request.headers.get("x-forwarded-for") ?? "local", 20, 60_000);
    const body = (await request.json()) as { question?: string };
    const result = await askAudienceIq(String(body.question ?? ""));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
