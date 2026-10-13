"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SetParams } from "./Browser";
import { FAMILIES, familyOf } from "@/lib/families";
import { FILTER_KEYS, type Meta } from "@/lib/types";

type Props = { meta: Meta | null; sp: ReadonlyURLSearchParams; setParams: SetParams };

const input =
  "h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none";
const label = "text-[11px] font-medium uppercase tracking-wide text-zinc-500";

export default function FilterBar({ meta, sp, setParams }: Props) {
  const families = sp.get("family")?.split(",").filter(Boolean) ?? [];
  const techs = sp.get("tech")?.split(",").filter(Boolean) ?? [];
  const statuses = sp.get("status")?.split(",").filter(Boolean) ?? [];
  const region = sp.get("region") ?? "";
  const active = FILTER_KEYS.some((k) => sp.get(k));

  const toggleFamily = (key: string) => {
    const next = families.includes(key) ? families.filter((f) => f !== key) : [...families, key];
    setParams({ family: next.join(",") || null });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5 border-b border-zinc-200 bg-white px-4 py-2.5">
      <Field label="Technology">
        <div className="flex items-center gap-1">
          {FAMILIES.map((f) => {
            const on = families.includes(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleFamily(f.key)}
                aria-pressed={on}
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm ${
                  on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span className="size-2.5 rounded-full" style={{ background: f.color }} />
                {f.label}
              </button>
            );
          })}
          <MultiSelect
            title="Type"
            options={(meta?.technologies ?? []).map((t) => ({
              value: t.code,
              label: t.label,
              group: familyOf(t.family).label,
            }))}
            selected={techs}
            onChange={(v) => setParams({ tech: v.join(",") || null })}
          />
        </div>
      </Field>

      <Field label="Operational status">
        <div className="flex items-center gap-1">
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <input
              type="checkbox"
              checked={sp.get("operating") === "1"}
              onChange={(e) => setParams({ operating: e.target.checked ? "1" : null })}
            />
            Operating only
          </label>
          <MultiSelect
            title="Status"
            options={(meta?.statuses ?? []).map((s) => ({
              value: s.code,
              label: s.label,
              group: s.operating ? "Counted as operating" : "Not counted as operating",
            }))}
            selected={statuses}
            onChange={(v) => setParams({ status: v.join(",") || null })}
          />
        </div>
      </Field>

      <Field label="Capacity, MW">
        <div className="flex items-center gap-1">
          <TextInput value={sp.get("mwMin")} onCommit={(v) => setParams({ mwMin: v })} placeholder="min" type="number" width="w-20" />
          <span className="text-zinc-400">–</span>
          <TextInput value={sp.get("mwMax")} onCommit={(v) => setParams({ mwMax: v })} placeholder="max" type="number" width="w-20" />
        </div>
      </Field>

      <Field label="Owner">
        <OwnerInput value={sp.get("owner")} onCommit={(v) => setParams({ owner: v })} />
      </Field>

      <Field label="Location">
        <div className="flex items-center gap-1">
          <select
            className={`${input} w-36`}
            value={region}
            onChange={(e) => setParams({ region: e.target.value || null, province: null })}
          >
            <option value="">All regions</option>
            {meta?.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className={`${input} w-36`}
            value={sp.get("province") ?? ""}
            onChange={(e) => setParams({ province: e.target.value || null })}
          >
            <option value="">All provinces</option>
            {meta?.provinces
              .filter((p) => !region || String(p.region) === region)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <TextInput value={sp.get("muni")} onCommit={(v) => setParams({ muni: v })} placeholder="Municipality" width="w-32" />
        </div>
      </Field>

      <Field label="Plant name">
        <TextInput value={sp.get("q")} onCommit={(v) => setParams({ q: v })} placeholder="Search…" width="w-40" />
      </Field>

      {active && (
        <button
          className="h-8 px-1 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
          onClick={() => setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{text}</span>
      {children}
    </div>
  );
}

// Text box that writes to the URL after the user pauses typing (or on Enter / blur)
function TextInput({
  value,
  onCommit,
  placeholder,
  type = "text",
  width,
}: {
  value: string | null;
  onCommit: (v: string | null) => void;
  placeholder: string;
  type?: string;
  width: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // the URL changed from elsewhere (e.g. "Clear filters")
    setPrev(value);
    setDraft(value ?? "");
  }

  useEffect(() => {
    if (draft.trim() === (value ?? "")) return;
    const t = setTimeout(() => onCommit(draft.trim() || null), 450);
    return () => clearTimeout(t);
  }, [draft, value, onCommit]);

  return (
    <input
      className={`${input} ${width}`}
      type={type}
      min={type === "number" ? 0 : undefined}
      step="any"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onCommit(draft.trim() || null)}
    />
  );
}

// Owner box with suggestions from the largest commercial names that match
function OwnerInput({ value, onCommit }: { value: string | null; onCommit: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  const [suggestions, setSuggestions] = useState<{ name: string; plants: number; mw: number }[]>([]);
  if (value !== prev) {
    setPrev(value);
    setDraft(value ?? "");
  }

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/owners?q=${encodeURIComponent(draft.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setSuggestions)
        .catch(() => {});
      if (draft.trim() !== (value ?? "")) onCommit(draft.trim() || null);
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft, value, onCommit]);

  return (
    <>
      <input
        className={`${input} w-48`}
        list="owner-suggestions"
        value={draft}
        placeholder="Company or group…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onCommit(draft.trim() || null)}
      />
      <datalist id="owner-suggestions">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name}>
            {`${s.plants} plants · ${Math.round(s.mw).toLocaleString("en-US")} MW`}
          </option>
        ))}
      </datalist>
    </>
  );
}

type Option = { value: string; label: string; group: string };

// Checkbox list in a popover; options are shown under their group headings
function MultiSelect({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const groups = [...new Set(options.map((o) => o.group))];
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex h-8 items-center gap-1 rounded-md border px-2 text-sm ${
          selected.length ? "border-zinc-900 text-zinc-900" : "border-zinc-300 text-zinc-700"
        } bg-white hover:bg-zinc-50`}
      >
        {title}
        {selected.length > 0 && (
          <span className="rounded bg-zinc-900 px-1 text-[11px] font-medium text-white tabular-nums">{selected.length}</span>
        )}
        <span className="text-zinc-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 max-h-96 w-80 overflow-auto rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
          {groups.map((g) => (
            <div key={g} className="mb-1.5">
              <div className="px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{g}</div>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-zinc-50">
                    <input type="checkbox" className="mt-0.5" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                    {o.label}
                  </label>
                ))}
            </div>
          ))}
          {selected.length > 0 && (
            <button className="mt-1 px-1 text-xs text-zinc-500 hover:text-zinc-900" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
