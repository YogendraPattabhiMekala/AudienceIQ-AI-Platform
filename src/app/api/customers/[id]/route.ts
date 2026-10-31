import { getCustomer } from "@/lib/customers";
import { jsonError } from "@/lib/http";
import { QueryValidationError } from "@/lib/query-planner";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const result = await getCustomer(id);
    if (!result) {
      throw new QueryValidationError("Customer not found");
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
