"use client";

import maplibregl, { type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { SetParams } from "./Browser";
import { FAMILIES } from "@/lib/families";
import { fmtMw } from "@/lib/types";

type Points = { id: number[]; lon: number[]; lat: number[]; fam: number[]; mw: number[] };

type Props = {
  filterQuery: string;
  selected: number | null;
  onSelect: (id: number) => void;
  focus: [number, number] | null;
  activeFamilies: string[];
  setParams: SetParams;
};

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
  sources: {
    imagery: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    labels: {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "imagery", type: "raster", source: "imagery" },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.85 } },
  ],
};

const familyColor: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "f"],
  ...FAMILIES.flatMap((f, i) => [i, f.color]),
  FAMILIES[FAMILIES.length - 1].color,
] as unknown as maplibregl.ExpressionSpecification;

// radius grows with the square root of capacity, and with zoom (extra: px added at every stop, for the selection ring)
function radius(extra = 0): maplibregl.ExpressionSpecification {
  const stop = (base: number, k: number, max: number) => [
    "+",
    extra,
    ["min", max, ["+", base, ["*", k, ["sqrt", ["get", "mw"]]]]],
  ];
  return ["interpolate", ["linear"], ["zoom"], 4, stop(1, 0.22, 9), 9, stop(2.5, 0.6, 22), 13, stop(5, 1.1, 36)] as unknown as maplibregl.ExpressionSpecification;
}

function toGeoJSON(p: Points): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: p.id.map((id, i) => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [p.lon[i], p.lat[i]] },
      properties: { id, f: p.fam[i], mw: p.mw[i] },
    })),
  };
}

export default function MapView({ filterQuery, selected, onSelect, focus, activeFamilies, setParams }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pointsRef = useRef<Points | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; count: number } | null>(null);
  const loading = loaded?.key !== filterQuery;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE,
      center: [-3.7, 40.0],
      zoom: 5.3,
      maxPitch: 70,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    // style.load, not load: the plants must show even if the imagery tiles are slow or blocked
    map.once("style.load", () => {
      map.addSource("plants", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "plants",
        type: "circle",
        source: "plants",
        layout: { "circle-sort-key": ["get", "mw"] },
        paint: {
          "circle-color": familyColor,
          "circle-radius": radius(),
          "circle-opacity": 0.9,
          "circle-stroke-color": "rgba(0,0,0,0.55)",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 10, 1],
        },
      });
      map.addLayer({
        id: "selected",
        type: "circle",
        source: "plants",
        filter: ["==", ["get", "id"], -1],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": radius(4),
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      map.on("mouseenter", "plants", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "plants", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("mousemove", "plants", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const fam = FAMILIES[f.properties.f as number] ?? FAMILIES[FAMILIES.length - 1];
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<b>${fam.label}</b> · ${fmtMw(f.properties.mw as number)} MW<br/><span style="color:#71717a">Click for details</span>`)
          .addTo(map);
      });
      map.on("click", "plants", (e) => {
        const f = e.features?.[0];
        if (f) onSelectRef.current(f.properties.id as number);
      });
      setReady(true);
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // load the filtered points
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    fetch(`/api/points?${filterQuery}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((p: Points) => {
        pointsRef.current = p;
        (mapRef.current?.getSource("plants") as GeoJSONSource | undefined)?.setData(toGeoJSON(p));
        setLoaded({ key: filterQuery, count: p.id.length });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [filterQuery, ready]);

  useEffect(() => {
    if (ready) mapRef.current?.setFilter("selected", ["==", ["get", "id"], selected ?? -1]);
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!focus || !map) return;
    // the details drawer covers up to 460px on the right: centre the plant in what is left
    const covered = Math.min(460, map.getContainer().clientWidth);
    map.flyTo({ center: focus, zoom: Math.max(map.getZoom(), 12), duration: 1500, offset: [-covered / 2, 0] });
  }, [focus]);

  const fitToResults = () => {
    const p = pointsRef.current;
    if (!p?.id.length || !mapRef.current) return;
    const b = new maplibregl.LngLatBounds();
    p.lon.forEach((lon, i) => b.extend([lon, p.lat[i]]));
    mapRef.current.fitBounds(b, { padding: 60, maxZoom: 13, duration: 1200 });
  };

  const toggleFamily = (key: string) => {
    const next = activeFamilies.includes(key) ? activeFamilies.filter((f) => f !== key) : [...activeFamilies, key];
    setParams({ family: next.join(",") || null });
  };

  return (
    <div className="absolute inset-0 bg-zinc-950">
      {/* explicit size: maplibre sets position: relative on its container, which would cancel inset-0 */}
      <div ref={container} className="h-full w-full" />

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <button
          onClick={fitToResults}
          className="rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow hover:bg-white"
        >
          Zoom to results
        </button>
        <span className="rounded-md bg-black/60 px-2 py-1.5 text-xs text-white tabular-nums">
          {loading ? "Loading plants…" : `${loaded.count.toLocaleString("en-US")} plants on the map`}
        </span>
      </div>

      <div className="absolute bottom-8 left-3 rounded-md bg-white/95 p-2.5 text-xs shadow">
        <div className="mb-1.5 font-medium text-zinc-700">Technology</div>
        {FAMILIES.map((f) => {
          const dimmed = activeFamilies.length > 0 && !activeFamilies.includes(f.key);
          return (
            <button
              key={f.key}
              onClick={() => toggleFamily(f.key)}
              className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-100 ${dimmed ? "opacity-40" : ""}`}
            >
              <span className="size-2.5 rounded-full ring-1 ring-black/30" style={{ background: f.color }} />
              <span className="text-zinc-800">{f.label}</span>
            </button>
          );
        })}
        <div className="mt-1.5 border-t border-zinc-200 pt-1.5 text-zinc-500">Circle size: capacity</div>
      </div>
    </div>
  );
}
