import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// One instance per server process; survives Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { claspDb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
    const db = drizzlePg(pool, { schema });
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) to this Vercel project.");
  }

  // No DATABASE_URL: embedded Postgres (PGlite) on local disk, so the app runs with zero setup.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.claspDb) {
    globalForDb.claspDb = connect().catch((err) => {
      globalForDb.claspDb = undefined;
      throw err;
    });
  }
  return globalForDb.claspDb;
}

export { schema };
