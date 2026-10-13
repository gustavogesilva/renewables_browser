"use client";

import { useEffect, useState } from "react";
import { familyOf } from "@/lib/families";
import { fmtMw, type PlantDetail, type Rec } from "@/lib/types";

type Props = { id: number; onClose: () => void; onShowOnMap: (lon: number, lat: number) => void };

type Value = string | number | boolean | null | undefined;

function show(v: Value) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return v;
}

export default function PlantDrawer({ id, onClose, onShowOnMap }: Props) {
  const [fetched, setFetched] = useState<{ id: number; data: PlantDetail | null } | null>(null);
  const data = fetched?.id === id ? fetched.data : null;
  const error = fetched?.id === id && !fetched.data;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/plants/${id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: PlantDetail) => setFetched({ id, data: d }))
      .catch(() => {
        if (!ctrl.signal.aborted) setFetched({ id, data: null });
      });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = data?.card;
  const p = data?.plant ?? {};
  const fam = familyOf(String(c?.family ?? "other"));

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[460px] flex-col border-l border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          {c ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="size-2.5 rounded-full ring-1 ring-black/20" style={{ background: fam.color }} />
                {String(c.technology)}
              </div>
              <h2 className="mt-0.5 text-base font-semibold leading-snug text-zinc-900">{String(c.name)}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                <span className="font-semibold text-zinc-900 tabular-nums">{fmtMw(Number(c.installed_mw))} MW</span> ·{" "}
                {String(c.status)}
              </p>
            </>
          ) : (
            <p className="py-2 text-sm text-zinc-500">{error ? "Could not load this plant." : "Loading…"}</p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close details" className="rounded p-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
          ×
        </button>
      </div>

      {c && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
          <Section title="Plant">
            <KV k="Capacity" v={`${show(Number(c.installed_mw))} MW (${show(Number(c.installed_kw))} kW)`} />
            <KV k="Technology" v={c.technology} />
            <KV k="Status" v={c.status} />
            <KV k="Counts as operating" v={c.counts_as_operating} />
            <KV k="Renewable" v={c.is_renewable} />
            <KV k="Registry" v={[c.registry, c.registry_key].filter(Boolean).join(" · ")} />
            <KV k="Commissioned" v={c.commissioning_date} />
            <KV k="First registered" v={c.first_registration_date} />
            <KV k="Deregistered" v={p.deregistration_date} />
            <KV k="Registration type" v={p.registration_type} />
            <KV k="RD 413 group" v={p.rd413_group} />
            <KV k="Pumped storage" v={c.pumped_storage} />
            <KV k="River" v={p.river} />
            <KV k="Hydro management unit" v={p.hydro_management_unit} />
            <KV k="Grid node" v={p.grid_node} />
          </Section>

          <Section title="Location">
            <KV k="Municipality" v={c.municipality} />
            <KV k="Province" v={c.province} />
            <KV k="Region" v={c.region} />
            {c.lat !== null && c.lon !== null && (
              <KV
                k="Coordinates"
                v={
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="tabular-nums">
                      {String(c.lat)}, {String(c.lon)}
                    </span>
                    <button onClick={() => onShowOnMap(Number(c.lon), Number(c.lat))} className="text-xs font-medium text-blue-700 hover:underline">
                      Show on map
                    </button>
                  </span>
                }
              />
            )}
            <KV k="Point precision" v={c.location_precision} />
            <KV k="Point source" v={c.location_source} />
          </Section>

          <Section title="Ownership">
            <KV k="Holder" v={c.holder ?? (c.holder_is_natural_person ? "Private individual" : null)} />
            <KV k="Holder tax id" v={c.holder_tax_id} />
            <KV k="Commercial name" v={c.commercial_name} />
            <KV k="Group parent" v={c.group_parent} />
            <KV k="Ultimate owner" v={c.ultimate_owner} />
            <KV k="Ownership chain" v={c.ownership_chain} />
            <KV k="Holder source" v={[c.holder_source, c.holder_as_of && `as of ${c.holder_as_of}`].filter(Boolean).join(", ")} />
            <KV k="Holder confidence" v={[c.holder_confidence, c.holder_agreement].filter(Boolean).join(" · ")} />
            <KV k="Group basis" v={[c.group_basis, c.group_confidence && `${c.group_confidence} confidence`].filter(Boolean).join(" · ")} />
            {!c.holder && !c.holder_is_natural_person && <p className="py-1 text-sm text-zinc-500">No holder identified in the sources.</p>}
          </Section>

          <List title="Evidence for the holder" rows={data.evidence}>
            {(e) => (
              <div className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium text-zinc-900">{String(e.stated_holder ?? "—")}</span>
                  <span className="text-xs text-zinc-500">{show(e.as_of)}</span>
                </div>
                <div className="text-xs text-zinc-600">
                  {[e.source, e.role, e.act, e.tax_id, e.confidence && `${e.confidence} confidence`].filter(Boolean).join(" · ")}
                </div>
                {e.document && (
                  <div className="text-xs">
                    {e.document_url ? (
                      <a href={String(e.document_url)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                        {String(e.document)} ↗
                      </a>
                    ) : (
                      <span className="text-zinc-600">{String(e.document)}</span>
                    )}
                  </div>
                )}
                {e.detail && <div className="mt-0.5 text-xs text-zinc-500">{String(e.detail)}</div>}
              </div>
            )}
          </List>

          <List title="Holder history" rows={data.history}>
            {(h) => (
              <div className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium text-zinc-900">
                    {String(h.holder)}
                    {h.share_pct !== null && <span className="font-normal text-zinc-500"> · {String(h.share_pct)}%</span>}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {String(h.valid_from)} → {h.valid_to ? String(h.valid_to) : "current"}
                  </span>
                </div>
                <div className="text-xs text-zinc-600">{[h.commercial_name, h.tax_id, h.source].filter(Boolean).join(" · ")}</div>
              </div>
            )}
          </List>

          <List title="Registration phases" rows={data.phases}>
            {(ph) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="text-zinc-900">
                  Phase {String(ph.phase_no ?? ph.phase_seq)}
                  {ph.installed_kw !== null && <span className="text-zinc-500"> · {show(Number(ph.installed_kw))} kW</span>}
                </span>
                <span className="text-xs text-zinc-500">
                  {[ph.registration_type, ph.commissioning_date && `commissioned ${ph.commissioning_date}`].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
          </List>

          <List title="Generating units" rows={data.units}>
            {(u) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="text-zinc-900">
                  {String(u.unit_name ?? u.unit_key)}
                  {u.installed_mw !== null && <span className="text-zinc-500"> · {show(Number(u.installed_mw))} MW</span>}
                </span>
                <span className="text-xs text-zinc-500">{[u.unit_type, u.state, u.commissioning_date].filter(Boolean).join(" · ")}</span>
              </div>
            )}
          </List>

          <List title="Points given by sources" rows={data.locations}>
            {(l) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="text-zinc-900">
                  {String(l.source)}
                  {l.used && <span className="ml-1.5 rounded bg-zinc-900 px-1 text-[10px] font-medium text-white">USED</span>}
                </span>
                <span className="text-xs tabular-nums text-zinc-500">
                  {String(l.lat)}, {String(l.lon)}
                  {l.precision && ` · ${l.precision}`}
                </span>
              </div>
            )}
          </List>

          <List title="In other datasets" rows={data.external_refs}>
            {(x) => (
              <div className="text-sm">
                <span className="text-zinc-900">{String(x.source)}</span>{" "}
                {x.url ? (
                  <a href={String(x.url)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                    {String(x.name ?? x.external_id)} ↗
                  </a>
                ) : (
                  <span className="text-zinc-600">{String(x.name ?? x.external_id)}</span>
                )}
                {x.detail && <div className="text-xs text-zinc-500">{String(x.detail)}</div>}
              </div>
            )}
          </List>
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      <dl className="divide-y divide-zinc-100">{children}</dl>
    </section>
  );
}

function KV({ k, v }: { k: string; v: Value | React.ReactNode }) {
  const shown = typeof v === "object" && v !== null ? v : show(v as Value);
  if (shown === null) return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="min-w-0 break-words text-zinc-900">{shown}</dd>
    </div>
  );
}

function List({ title, rows, children }: { title: string; rows: Rec[] | null; children: (r: Rec) => React.ReactNode }) {
  if (!rows?.length) return null;
  return (
    <section className="mt-5">
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title} <span className="tabular-nums text-zinc-400">({rows.length})</span>
      </h3>
      <ul className="divide-y divide-zinc-100">
        {rows.map((r, i) => (
          <li key={i} className="py-2">
            {children(r)}
          </li>
        ))}
      </ul>
    </section>
  );
}
