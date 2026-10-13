export type Meta = {
  data_date: string | null;
  technologies: { code: string; label: string; family: string }[];
  statuses: { code: string; label: string; operating: boolean }[];
  regions: { id: number; name: string }[];
  provinces: { id: number; name: string; region: number }[];
};

export type PlantRow = {
  plant_id: number;
  name: string;
  technology: string;
  family: string;
  status: string;
  counts_as_operating: boolean;
  mw: number;
  commercial_name: string | null;
  holder: string | null;
  municipality: string | null;
  province: string | null;
  region: string | null;
  commissioned: string | null;
};

export type PlantPage = { total: number; mw: number; page: number; pageSize: number; rows: PlantRow[] };

type Json = string | number | boolean | null;
export type Rec = Record<string, Json>;

export type PlantDetail = {
  card: Rec;
  plant: Rec | null;
  evidence: Rec[] | null;
  history: Rec[] | null;
  phases: Rec[] | null;
  units: Rec[] | null;
  external_refs: Rec[] | null;
  locations: Rec[] | null;
};

// URL params that filter the plants (everything else in the URL is view state)
export const FILTER_KEYS = ["family", "tech", "status", "operating", "mwMin", "mwMax", "owner", "region", "province", "muni", "q"];

export function fmtMw(mw: number) {
  return mw >= 100 ? Math.round(mw).toLocaleString("en-US") : mw.toLocaleString("en-US", { maximumFractionDigits: mw < 1 ? 3 : 1 });
}
