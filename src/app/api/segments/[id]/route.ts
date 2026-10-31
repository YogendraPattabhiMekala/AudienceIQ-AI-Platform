import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, segmentMemberships, segments } from "@/db/schema";
import { jsonError } from "@/lib/http";
import { QueryValidationError } from "@/lib/query-planner";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const [segment] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
    if (!segment) throw new QueryValidationError("Segment not found");
    const members = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        lifetimeValue: customers.lifetimeValue,
        churnScore: customers.churnScore,
        campaignEngagementScore: customers.campaignEngagementScore,
        state: customers.state,
        favoriteCategory: customers.favoriteCategory,
        daysSinceLastPurchase: customers.daysSinceLastPurchase,
      })
      .from(segmentMemberships)
      .innerJoin(customers, eq(customers.id, segmentMemberships.customerId))
      .where(eq(segmentMemberships.segmentId, id))
      .orderBy(desc(customers.lifetimeValue))
      .limit(100);
    return Response.json({ ok: true, segment, members });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await db.delete(segments).where(eq(segments.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
