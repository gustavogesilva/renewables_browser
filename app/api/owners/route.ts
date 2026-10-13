import type { NextRequest } from "next/server";
import { CACHE_HEADERS, query } from "@/lib/db";

// Owner suggestions: commercial names matching q, largest portfolio first.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const rows = await query(
    `select c.commercial_name as name, count(*)::int as plants, round(sum(c.installed_mw), 1)::float8 as mw
     from api.plant_card c
     where c.commercial_name is not null and core.fold(c.commercial_name) like core.fold($1)
     group by 1 order by 3 desc limit 12`,
    [`%${q.replace(/[\\%_]/g, (ch) => "\\" + ch)}%`],
  );
  return Response.json(rows, { headers: CACHE_HEADERS });
}
