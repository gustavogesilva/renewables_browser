import { connection } from "next/server";
import { CACHE_HEADERS, query } from "@/lib/db";

// Lookups for the filter bar, and the date of the loaded data.
export async function GET() {
  await connection();
  const [meta] = await query(`
    select (select data_date::text from core.load_run order by load_id desc limit 1) as data_date,
           (select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'family', family) order by family, label)
              from ref.technology) as technologies,
           (select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'operating', counts_as_operating)
                             order by counts_as_operating desc, label) from ref.plant_status) as statuses,
           (select jsonb_agg(jsonb_build_object('id', ccaa_id, 'name', name) order by name) from ref.region) as regions,
           (select jsonb_agg(jsonb_build_object('id', province_id, 'name', name, 'region', ccaa_id) order by name)
              from ref.province) as provinces`);
  return Response.json(meta, { headers: CACHE_HEADERS });
}
