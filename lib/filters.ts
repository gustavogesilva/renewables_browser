import { FAMILY_KEYS } from "./families";

// One filter definition for both views. Multi-value params are comma-separated: ?family=solar,wind
export type Filters = {
  family: string[];
  tech: string[];
  status: string[];
  operating: boolean;
  mwMin: number | null;
  mwMax: number | null;
  owner: string | null;
  region: number | null;
  province: number | null;
  muni: string | null;
  q: string | null;
};

const CODE = /^[a-z0-9_]+$/;

function list(sp: URLSearchParams, key: string) {
  return (sp.get(key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CODE.test(s));
}

function num(sp: URLSearchParams, key: string) {
  const v = sp.get(key);
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function text(sp: URLSearchParams, key: string) {
  const v = sp.get(key)?.trim();
  return v ? v.slice(0, 100) : null;
}

export function parseFilters(sp: URLSearchParams): Filters {
  return {
    family: list(sp, "family").filter((f) => FAMILY_KEYS.includes(f)),
    tech: list(sp, "tech"),
    status: list(sp, "status"),
    operating: sp.get("operating") === "1",
    mwMin: num(sp, "mwMin"),
    mwMax: num(sp, "mwMax"),
    owner: text(sp, "owner"),
    region: num(sp, "region"),
    province: num(sp, "province"),
    muni: text(sp, "muni"),
    q: text(sp, "q"),
  };
}

// "contains" pattern for LIKE, with the user's own wildcards escaped
function contains(s: string) {
  return `%${s.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
}

// WHERE clause over api.plant_card (alias c). Pushes its values onto params and returns the SQL text.
export function whereSql(f: Filters, params: unknown[]): string {
  const where: string[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.family.length) where.push(`c.family = any(${p(f.family)}::text[])`);
  if (f.tech.length) where.push(`c.technology_code = any(${p(f.tech)}::text[])`);
  if (f.status.length) where.push(`c.status_code = any(${p(f.status)}::text[])`);
  if (f.operating) where.push("c.counts_as_operating");
  if (f.mwMin !== null) where.push(`c.installed_mw >= ${p(f.mwMin)}`);
  if (f.mwMax !== null) where.push(`c.installed_mw <= ${p(f.mwMax)}`);
  if (f.owner) {
    const o = p(contains(f.owner));
    where.push(`(core.fold(c.commercial_name) like core.fold(${o}) or core.fold(c.holder) like core.fold(${o}))`);
  }
  if (f.region !== null) where.push(`c.ccaa_id = ${p(f.region)}`);
  if (f.province !== null) where.push(`c.province_id = ${p(f.province)}`);
  if (f.muni) where.push(`core.fold(c.municipality) like core.fold(${p(contains(f.muni))})`);
  if (f.q) where.push(`core.fold(c.name) like core.fold(${p(contains(f.q))})`);
  return where.length ? `where ${where.join(" and ")}` : "";
}
