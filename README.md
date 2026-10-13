# Renewables browser

Demo viewer for the Spanish renewable plants database (69,963 plants, load of 2026-10-13): a satellite map and a list,
the same filters on top of both, and a details panel for any plant.

Everything runs on one Vercel project: Next.js for the pages and the API (route handlers), and Neon Postgres (attached
from the project's Storage tab) for the data.

## How it fits together

| Piece | Where |
|---|---|
| Filters (technology, status, MW, owner, location, name) | `lib/filters.ts` turns URL params into one SQL `WHERE` over `api.plant_card`, shared by every route |
| List | `GET /api/plants` sorted, 50 a page, with count and MW of the filtered set (`?summary=1` for the totals only) |
| Map points | `GET /api/points` every filtered plant with a point, as parallel arrays (about 2 MB for all of them) |
| Plant details | `GET /api/plants/:id` the plant card plus evidence, holder history, phases, units, source points, external ids |
| Owner suggestions, lookups | `GET /api/owners?q=`, `GET /api/meta` |
| UI | `components/`: `Browser` keeps all state in the URL, so links are shareable and both views read the same filters |

The map is MapLibre GL with Esri World Imagery tiles on a globe. Esri imagery is free to use with attribution for a demo;
production use needs an ArcGIS key or another imagery provider.

API responses carry `s-maxage=86400`: the data only changes when a new load is seeded, and a new deployment starts
with an empty cache.

## Environment

`DATABASE_URL`: Postgres connection string. The Neon integration sets it on the Vercel project.

## Loading the data

The database dump is not in this repository (the repository is public). Load it into an empty database with:

```bash
DATABASE_URL='postgresql://...' npm run seed -- /path/to/renewables_2026-10-13.dump
```

It needs `pg_restore` 16 or newer. The dump is turned into plain SQL, the table data goes in as batched INSERTs over
Neon's WebSocket driver (port 443), and the whole load is one transaction. It refuses to run if the database already
holds the data; add `--reset` to drop the `api`, `core` and `ref` schemas and load again. Use the unpooled connection
string (`DATABASE_URL_UNPOOLED` in the Neon integration).

## Local development

```bash
npm install
DATABASE_URL='postgresql://...' npm run dev
```

Any Postgres 16 with PostGIS, `pg_trgm` and `unaccent` works, local or Neon.
