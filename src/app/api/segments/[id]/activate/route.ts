import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activations, segments } from "@/db/schema";
import { jsonError } from "@/lib/http";
import { QueryValidationError } from "@/lib/query-planner";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const DESTINATIONS = new Set(["paid_media", "email", "crm"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const body = (await request.json()) as { destination?: string };
    const destination = String(body.destination ?? "");
    if (!DESTINATIONS.has(destination)) {
      throw new QueryValidationError("Destination must be paid_media, email, or crm");
    }
    const [segment] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
    if (!segment) throw new QueryValidationError("Segment not found");
    const now = new Date().toISOString();
    const activationId = `act_${Date.now().toString(36)}`;
    await db.insert(activations).values({
      id: activationId,
      segmentId: segment.id,
      segmentName: segment.name,
      destination,
      status: "queued",
      customerCount: segment.memberCount,
      segmentVersion: segment.version,
      message: "Activation job accepted (simulated export).",
      createdAt: now,
    });
    await db
      .update(activations)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
        message: `Simulated export of ${segment.memberCount} customers to ${destination.replace(/_/g, " ")} as ${segment.name.replace(/ /g, "_")}_v${segment.version}. No advertising credentials were used.`,
      })
      .where(eq(activations.id, activationId));
    const [row] = await db.select().from(activations).where(eq(activations.id, activationId));
    return Response.json({ ok: true, activation: row });
  } catch (error) {
    return jsonError(error);
  }
}
