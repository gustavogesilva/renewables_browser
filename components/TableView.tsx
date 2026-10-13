"use client";

import { useEffect, useState } from "react";
import type { SetParams } from "./Browser";
import { familyOf } from "@/lib/families";
import { fmtMw, type PlantPage } from "@/lib/types";

type Props = {
  filterQuery: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  selected: number | null;
  onSelect: (id: number) => void;
  setParams: SetParams;
};

const COLUMNS = [
  { key: "name", label: "Plant" },
  { key: "technology", label: "Technology" },
  { key: "status", label: "Status" },
  { key: "mw", label: "MW", numeric: true },
  { key: "owner", label: "Owner" },
  { key: "province", label: "Location" },
  { key: "commissioned", label: "Commissioned" },
] as const;

export default function TableView({ filterQuery, sort, dir, page, selected, onSelect, setParams }: Props) {
  const key = `${filterQuery}&sort=${sort}&dir=${dir}&page=${page}`;
  const [fetched, setFetched] = useState<{ key: string; data: PlantPage } | null>(null);
  const data = fetched?.data ?? null;
  const loading = fetched?.key !== key;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/plants?${key}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: PlantPage) => setFetched({ key, data: d }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  // same column flips the direction; a new column starts largest/newest first for numbers and dates, A-Z otherwise
  const sortBy = (key: string) => {
    const next = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "mw" || key === "commissioned" ? "desc" : "asc";
    setParams({ sort: key, dir: next, page: null });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      <div className={`min-h-0 flex-1 overflow-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50 shadow-[inset_0_-1px_0_#e4e4e7]">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 ${
                    "numeric" in c ? "text-right" : "text-left"
                  }`}
                  aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <button className="uppercase hover:text-zinc-900" onClick={() => sortBy(c.key)}>
                    {c.label}
                    <span className="ml-1 inline-block w-2 text-zinc-900">{sort === c.key ? (dir === "asc" ? "↑" : "↓") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => {
              const fam = familyOf(r.family);
              return (
                <tr
                  key={r.plant_id}
                  onClick={() => onSelect(r.plant_id)}
                  className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${
                    selected === r.plant_id ? "bg-amber-50 hover:bg-amber-50" : ""
                  }`}
                >
                  <td className="max-w-72 truncate px-3 py-2 font-medium text-zinc-900" title={r.name}>
                    {r.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    <span className="mr-1.5 inline-block size-2 rounded-full ring-1 ring-black/20" style={{ background: fam.color }} />
                    {r.technology}
                  </td>
                  <td className="max-w-56 truncate px-3 py-2" title={r.status}>
                    <span className={r.counts_as_operating ? "text-zinc-800" : "text-zinc-500"}>{r.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-900">{fmtMw(r.mw)}</td>
                  <td className="max-w-64 truncate px-3 py-2 text-zinc-700" title={r.holder ?? undefined}>
                    {r.commercial_name ?? r.holder ?? <span className="text-zinc-400">Unknown</span>}
                  </td>
                  <td className="max-w-56 truncate px-3 py-2 text-zinc-700">
                    {[r.municipality, r.province].filter(Boolean).join(", ")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-600">{r.commissioned ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.rows.length === 0 && <p className="p-8 text-center text-sm text-zinc-500">No plants match these filters.</p>}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600">
        <span className="tabular-nums">
          {data ? `${((page - 1) * data.pageSize + 1).toLocaleString("en-US")}–${Math.min(page * data.pageSize, data.total).toLocaleString("en-US")} of ${data.total.toLocaleString("en-US")}` : "…"}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}
            className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tabular-nums">
            Page {page} of {pages.toLocaleString("en-US")}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setParams({ page: String(page + 1) })}
            className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
