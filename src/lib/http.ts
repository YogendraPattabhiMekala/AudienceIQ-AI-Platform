import { QueryValidationError } from "./query-planner";

export function jsonError(error: unknown, fallback = "Request failed") {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof QueryValidationError ? 400 : 500;
  return Response.json({ ok: false, error: message }, { status });
}

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new QueryValidationError("Too many requests. Please wait a moment.");
  }
}
