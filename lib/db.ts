import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { requireSession } from "./auth";

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

// Every read checks the session first, so no route can reach the data without the site password.
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  await requireSession();
  return (await getPool().query(text, params)).rows as T[];
}

export async function queryArrays<T extends unknown[]>(text: string, params: unknown[] = []) {
  await requireSession();
  return (await getPool().query({ text, values: params, rowMode: "array" })).rows as T[];
}

// The data sits behind the site password: no shared (CDN) cache may hold it, and no browser copy may outlive a sign-out.
export const CACHE_HEADERS = { "Cache-Control": "private, no-store" };
