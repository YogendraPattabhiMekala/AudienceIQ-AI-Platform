import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { jsonError } from "@/lib/http";
import { QueryValidationError } from "@/lib/query-planner";
import { ensureSeeded } from "@/lib/seed";
import { recomputeSegment, validateRules } from "@/lib/segments";
import { getSyncState } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const [rows, sync] = await Promise.all([
      db.select().from(segments).orderBy(desc(segments.updatedAt)),
      getSyncState(),
    ]);
    return Response.json({ ok: true, rows, sync });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      combinator?: string;
      rules?: unknown;
    };
    const name = String(body.name ?? "").trim();
    if (name.length < 3) throw new QueryValidationError("Segment name must be at least 3 characters");
    const { rules, combinator } = validateRules(body.rules, body.combinator ?? "and");
    const id = `seg_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    await db.insert(segments).values({
      id,
      name,
      description: String(body.description ?? "").slice(0, 500),
      combinator,
      rules,
      createdAt: now,
      updatedAt: now,
    });
    await recomputeSegment(id);
    const [row] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
    return Response.json({ ok: true, segment: row });
  } catch (error) {
    return jsonError(error);
  }
}
