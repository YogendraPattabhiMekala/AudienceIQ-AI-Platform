export function resultRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return rows as T[];
}
