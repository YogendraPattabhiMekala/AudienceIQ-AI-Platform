import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await ensureSeeded();
    return Response.json({ ok: true, ...result, demoMode: process.env.DEMO_MODE !== "false" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
