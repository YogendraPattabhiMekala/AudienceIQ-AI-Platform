import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __audienceIqPool?: Pool;
};
type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | undefined;

function getDatabase(): Database {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for database operations");
  const pool = globalForDb.__audienceIqPool ?? new Pool({ connectionString: url });
  if (process.env.NODE_ENV !== "production") globalForDb.__audienceIqPool = pool;
  database = drizzle(pool, { schema });
  return database;
}

// Delay connection configuration until a query is actually used.
// Route-module imports during `next build` must not connect to PostgreSQL.
export const db = new Proxy({} as Database, {
  get(_target, key) {
    const realDb = getDatabase();
    const value = Reflect.get(realDb, key, realDb);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
export { schema };
