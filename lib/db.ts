import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

let pool: Pool | null = null;

// Created on first use so the app builds without a database attached.
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
    attachDatabasePool(pool); // lets Vercel close idle connections before the function suspends
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await getPool().query(text, params)).rows as T[];
}

export async function queryArrays<T extends unknown[]>(text: string, params: unknown[] = []) {
  return (await getPool().query({ text, values: params, rowMode: "array" })).rows as T[];
}

// The data only changes when a new load is seeded, so let the CDN keep responses for a day.
export const CACHE_HEADERS = { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" };
