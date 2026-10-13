import type { NextRequest } from "next/server";
import { CACHE_HEADERS, query } from "@/lib/db";

// Everything the dataset holds about one plant, in one round trip.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/plants/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const [{ d }] = await query<{ d: { card: Record<string, unknown> | null } }>(
    `select jsonb_build_object(
       'card', (select to_jsonb(c) - 'geom' from api.plant_card c where c.plant_id = $1),
       'plant', (select jsonb_build_object('registration_type', p.registration_type, 'rd413_group', p.rd413_group,
                        'river', p.river, 'hydro_management_unit', p.hydro_management_unit, 'grid_node', p.grid_node,
                        'deregistration_date', p.deregistration_date)
                 from core.plant p where p.plant_id = $1),
       'evidence', (select jsonb_agg(to_jsonb(e) - 'plant_id' order by e.as_of desc nulls last, e.source)
                    from api.plant_evidence e where e.plant_id = $1),
       'history', (select jsonb_agg(to_jsonb(h) - 'plant_id' order by h.valid_from desc)
                   from api.holder_history h where h.plant_id = $1),
       'phases', (select jsonb_agg(to_jsonb(ph) - 'plant_id' order by ph.phase_seq)
                  from core.plant_phase ph where ph.plant_id = $1),
       'units', (select jsonb_agg(to_jsonb(u) - 'plant_id' order by u.unit_key)
                 from core.plant_unit u where u.plant_id = $1),
       'external_refs', (select jsonb_agg(jsonb_build_object('source', s.name, 'external_id', x.external_id, 'name', x.name,
                                                             'url', x.url, 'detail', x.detail) order by s.name)
                         from core.plant_external_ref x join ref.source s using (source_id) where x.plant_id = $1),
       'locations', (select jsonb_agg(jsonb_build_object('source', s.name, 'lon', round(st_x(l.geom)::numeric, 6),
                                                         'lat', round(st_y(l.geom)::numeric, 6), 'precision', l.location_precision,
                                                         'confidence', l.confidence, 'km_from_municipality', l.km_from_municipality,
                                                         'used', l.used) order by l.used desc, s.name)
                     from core.plant_location_claim l join ref.source s using (source_id) where l.plant_id = $1)
     ) as d`,
    [id],
  );
  if (!d.card) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(d, { headers: CACHE_HEADERS });
}
