"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FilterBar from "./FilterBar";
import PlantDrawer from "./PlantDrawer";
import TableView from "./TableView";
import { FILTER_KEYS, fmtMw, type Meta } from "@/lib/types";

// MapLibre needs the browser
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full bg-zinc-900" />,
});

export type SetParams = (updates: Record<string, string | null>) => void;

export default function Browser() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetched, setFetched] = useState<{ key: string; total: number; mw: number } | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);

  const view = sp.get("view") === "list" ? "list" : "map";
  const selected = Number(sp.get("plant")) || null;

  // only the filter params, in a stable order: the key both views fetch with
  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) q.set(k, v);
    }
    return q.toString();
  }, [sp]);

  const setParams: SetParams = useCallback(
    (updates) => {
      // build on the live URL, not the last render's params, so quick successive changes all land
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (Object.keys(updates).some((k) => FILTER_KEYS.includes(k))) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/plants?${filterQuery}&summary=1`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((s) => setFetched({ key: filterQuery, ...s }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [filterQuery]);
  const summary = fetched?.key === filterQuery ? fetched : null;

  const select = useCallback((id: number | null) => setParams({ plant: id ? String(id) : null }), [setParams]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <div className="mr-auto">
          <h1 className="text-[15px] font-semibold tracking-tight">Spanish renewables</h1>
          <p className="text-xs text-zinc-500">
            {summary ? (
              <>
                <span className="font-medium text-zinc-700 tabular-nums">{summary.total.toLocaleString("en-US")}</span>{" "}
                plants ·{" "}
                <span className="font-medium text-zinc-700 tabular-nums">{fmtMw(summary.mw)}</span> MW
              </>
            ) : (
              "Counting…"
            )}
            {meta?.data_date && <> · data as of {meta.data_date}</>}
          </p>
        </div>
        <div className="inline-flex rounded-md border border-zinc-300 p-0.5 text-sm" role="tablist">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setParams({ view: v === "map" ? null : "list" })}
              className={`rounded px-3 py-1 ${view === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {v === "map" ? "Satellite" : "List"}
            </button>
          ))}
        </div>
      </header>

      <FilterBar meta={meta} sp={sp} setParams={setParams} />

      <main className="relative min-h-0 flex-1">
        {view === "map" ? (
          <MapView
            filterQuery={filterQuery}
            selected={selected}
            onSelect={select}
            focus={focus}
            activeFamilies={sp.get("family")?.split(",").filter(Boolean) ?? []}
            setParams={setParams}
          />
        ) : (
          <TableView
            filterQuery={filterQuery}
            sort={sp.get("sort") ?? "mw"}
            dir={sp.get("dir") === "asc" ? "asc" : "desc"}
            page={Math.max(1, Number(sp.get("page")) || 1)}
            selected={selected}
            onSelect={select}
            setParams={setParams}
          />
        )}
        {selected && (
          <PlantDrawer
            id={selected}
            onClose={() => select(null)}
            onShowOnMap={(lon, lat) => {
              setFocus([lon, lat]);
              setParams({ view: null });
            }}
          />
        )}
      </main>
    </div>
  );
}
