import type { NextRequest } from "next/server";
import { CACHE_HEADERS, query } from "@/lib/db";
import { parseFilters, whereSql } from "@/lib/filters";

const PAGE_SIZE = 50;

// sortable columns: URL key -> SQL expression
const SORTS: Record<string, string> = {
  name: "c.name",
  mw: "c.installed_mw",
  technology: "c.technology",
  status: "c.status",
  owner: "coalesce(c.commercial_name, c.holder)",
  region: "c.region",
  province: "c.province",
  municipality: "c.municipality",
  commissioned: "c.commissioning_date",
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: unknown[] = [];
  const where = whereSql(parseFilters(sp), params);
  const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.mw;
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));

  const summarySql = `select count(*)::int as total, coalesce(round(sum(c.installed_mw), 1), 0)::float8 as mw
                      from api.plant_card c ${where}`;
  if (sp.get("summary") === "1") {
    const [summary] = await query<{ total: number; mw: number }>(summarySql, params);
    return Response.json(summary, { headers: CACHE_HEADERS });
  }

  const [summary, rows] = await Promise.all([
    query<{ total: number; mw: number }>(summarySql, params),
    query(
      `select c.plant_id::int, c.name, c.technology, c.family, c.status, c.counts_as_operating, c.installed_mw::float8 as mw,
              c.commercial_name, c.holder, c.municipality, c.province, c.region, c.commissioning_date::text as commissioned
       from api.plant_card c ${where}
       order by ${sort} ${dir} nulls last, c.plant_id
       limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
  ]);
  return Response.json({ ...summary[0], page, pageSize: PAGE_SIZE, rows }, { headers: CACHE_HEADERS });
}
