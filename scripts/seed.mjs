// Load the renewables pg_dump into an empty Postgres (Neon) database over Neon's WebSocket driver.
//
// Usage: DATABASE_URL=postgres://... node scripts/seed.mjs <renewables_YYYY-MM-DD.dump> [--reset]
//
// Needs pg_restore (PostgreSQL 16+) on the machine running it. The dump is turned into plain SQL; DDL runs as-is and
// every COPY block becomes batched INSERTs, so it works where only HTTPS/WebSocket egress is allowed. One transaction:
// a failed load leaves the database as it was. --reset drops the api, core and ref schemas first.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

const args = process.argv.slice(2);
const dump = args.find((a) => !a.startsWith("--"));
const reset = args.includes("--reset");
if (!dump || !process.env.DATABASE_URL) {
  console.error("usage: DATABASE_URL=... node scripts/seed.mjs <dump> [--reset]");
  process.exit(1);
}

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new HttpsProxyAgent(proxy);
  neonConfig.webSocketConstructor = class extends ws {
    constructor(url, protocols) {
      super(url, protocols, { agent });
    }
  };
} else {
  neonConfig.webSocketConstructor = ws;
}

// ---------------------------------------------------------------- dump -> plain SQL
function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
}

// PostGIS fills spatial_ref_sys itself, and extension comments need ownership the target may not have
const toc = run("pg_restore", ["-l", dump])
  .split("\n")
  .filter((l) => !/TABLE DATA public spatial_ref_sys/.test(l) && !/COMMENT - EXTENSION/.test(l))
  .join("\n");
const dir = mkdtempSync(join(tmpdir(), "seed-"));
writeFileSync(join(dir, "toc.list"), toc);
const plain = run("pg_restore", ["--no-owner", "--no-acl", "-L", join(dir, "toc.list"), "-f", "-", dump]);
rmSync(dir, { recursive: true });

// ---------------------------------------------------------------- COPY text format
const ESC = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
function decode(field) {
  if (field === "\\N") return null;
  if (!field.includes("\\")) return field;
  return field.replace(/\\(?:([0-7]{1,3})|x([0-9a-fA-F]{1,2})|(.))/g, (_, oct, hex, ch) =>
    oct ? String.fromCharCode(parseInt(oct, 8)) : hex ? String.fromCharCode(parseInt(hex, 16)) : (ESC[ch] ?? ch),
  );
}

// ---------------------------------------------------------------- load
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const { rows: existing } = await client.query("select to_regclass('api.plant_card') is not null as loaded");
if (existing[0].loaded && !reset) {
  console.error("api.plant_card already exists; pass --reset to drop api, core and ref and load again");
  process.exit(1);
}

let identity = null; // tables with GENERATED ALWAYS identity columns need OVERRIDING SYSTEM VALUE
async function identityTables() {
  const { rows } = await client.query(
    "select distinct table_schema || '.' || table_name as t from information_schema.columns where is_identity = 'YES'",
  );
  return new Set(rows.map((r) => r.t));
}

async function execPlain(lines) {
  // psql meta-commands (\restrict, \unrestrict) are not SQL
  const text = lines.filter((l) => !l.startsWith("\\")).join("\n");
  if (!text.replace(/--.*$/gm, "").trim()) return;
  await client.query(text);
}

const MAX_PARAMS = 60000;
const MAX_BYTES = 4 * 1024 * 1024;
async function insertBatch(table, cols, batch) {
  const n = cols.length;
  const values = batch.map((_, i) => `(${cols.map((__, j) => `$${i * n + j + 1}`).join(",")})`).join(",");
  const override = identity.has(table) ? " overriding system value" : "";
  await client.query(`insert into ${table} (${cols.join(",")})${override} values ${values}`, batch.flat());
}

try {
  await client.query("begin");
  if (reset) await client.query("drop schema if exists api, core, ref cascade");

  const lines = plain.split("\n");
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^COPY (\S+) \((.*)\) FROM stdin;$/);
    if (!m) {
      buf.push(lines[i]);
      continue;
    }
    await execPlain(buf);
    buf = [];
    identity ??= await identityTables();

    const [, table, colList] = m;
    const cols = colList.split(", ");
    let batch = [];
    let bytes = 0;
    let count = 0;
    for (i++; lines[i] !== "\\."; i++) {
      batch.push(lines[i].split("\t").map(decode));
      bytes += lines[i].length;
      count++;
      if ((batch.length + 1) * cols.length > MAX_PARAMS || bytes > MAX_BYTES) {
        await insertBatch(table, cols, batch);
        batch = [];
        bytes = 0;
      }
    }
    if (batch.length) await insertBatch(table, cols, batch);
    console.log(`  ${table.padEnd(28)} ${String(count).padStart(7)} rows  ${elapsed()}`);
  }
  console.log("  indexes, constraints, materialised views ...");
  await execPlain(buf);
  await client.query("commit");
  console.log(`committed in ${elapsed()}`);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("load failed, rolled back:", e.message);
  process.exit(1);
}

// ---------------------------------------------------------------- sanity checks
const { rows: checks } = await client.query(`
  select (select count(*) from api.plant_card)::int as plants,
         (select count(*) from api.plant_card where geom is not null)::int as with_point,
         (select round(sum(installed_kw) / 1000) from api.plant_card where counts_as_operating)::float8 as operating_mw,
         (select round(sum(installed_kw) / 1000, 1) from api.plant_card where commercial_name = 'Iberdrola')::float8 as iberdrola_mw,
         (select data_date::text from core.load_run order by load_id desc limit 1) as data_date`);
console.table(checks);
await client.end();
