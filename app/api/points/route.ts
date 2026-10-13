import type { NextRequest } from "next/server";
import { CACHE_HEADERS, queryArrays } from "@/lib/db";
import { FAMILY_KEYS } from "@/lib/families";
import { parseFilters, whereSql } from "@/lib/filters";

// Every filtered plant that has a point, as parallel arrays (about 30 bytes a plant) for the map layer.
export async function GET(request: NextRequest) {
  const params: unknown[] = [];
  const where = whereSql(parseFilters(request.nextUrl.searchParams), params);
  const rows = await queryArrays<[number, number, number, string, number]>(
    `select c.plant_id::int, round(c.lon, 5)::float8, round(c.lat, 5)::float8, c.family, c.installed_mw::float8
     from api.plant_card c ${where ? `${where} and` : "where"} c.geom is not null
     order by c.installed_mw`,
    params,
  );

  const out = { id: [] as number[], lon: [] as number[], lat: [] as number[], fam: [] as number[], mw: [] as number[] };
  for (const [id, lon, lat, family, mw] of rows) {
    out.id.push(id);
    out.lon.push(lon);
    out.lat.push(lat);
    out.fam.push(Math.max(0, FAMILY_KEYS.indexOf(family)));
    out.mw.push(mw);
  }
  return Response.json(out, { headers: CACHE_HEADERS });
}
