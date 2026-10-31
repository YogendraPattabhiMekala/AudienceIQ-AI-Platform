import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activations } from "@/db/schema";
import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const rows = await db.select().from(activations).orderBy(desc(activations.createdAt)).limit(100);
    return Response.json({ ok: true, rows });
  } catch (error) {
    return jsonError(error);
  }
}
