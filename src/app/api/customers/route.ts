import { listCustomers, parseFiltersParam } from "@/lib/customers";
import { getCustomerFreshness } from "@/lib/freshness";
import { jsonError } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const sort = url.searchParams.get("sort") ?? "lifetimeValue";
    const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
    const filters = parseFiltersParam(url.searchParams.get("filters"));
    const [result, freshness] = await Promise.all([
      listCustomers({ search, sort, dir, page, pageSize, filters }),
      getCustomerFreshness(),
    ]);
    return Response.json({ ok: true, ...result, freshness });
  } catch (error) {
    return jsonError(error);
  }
}
