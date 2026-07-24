"use client";

import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowsOutSimple,
  CaretRight,
  Funnel,
  MagnifyingGlass,
  Minus,
  Plus,
  Sparkle,
  Star,
  X,
} from "@phosphor-icons/react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AtlasPoint = {
  i: string;
  n: string;
  h: string;
  s: string;
  x: number;
  y: number;
  yr: number;
  rt: number;
  v: number;
  a: string[];
  nt: string[];
};

type Camera = { x: number; y: number; zoom: number };
type Cluster = { label: string; eyebrow: string; x: number; y: number };
type ScreenPoint = { point: AtlasPoint; x: number; y: number };

const INITIAL_CAMERA: Camera = { x: 0, y: 0, zoom: 0.88 };
const NUMBER = new Intl.NumberFormat("en");
const COLORS: Record<string, string> = {
  aquatic: "#45b8c8",
  aromatic: "#77a778",
  citrus: "#e8c54c",
  floral: "#e89bb7",
  fresh: "#77c8ba",
  fruity: "#dc7b6c",
  gourmand: "#c68b57",
  green: "#78a95a",
  leather: "#9a6e52",
  musky: "#b9a9cd",
  oud: "#88685d",
  powdery: "#b5a6db",
  rose: "#d87591",
  smoky: "#8c8a87",
  spicy: "#d88953",
  sweet: "#d994a8",
  vanilla: "#d7bd79",
  woody: "#9c8561",
};
const CLUSTERS = [
  ["Dark vanilla gourmands", "Rich & sweet", ["vanilla", "gourmand", "caramel", "cacao"]],
  ["Fresh aquatic citrus", "Bright & airy", ["aquatic", "marine", "citrus", "ozonic"]],
  ["Classic green fragrances", "Crisp & herbal", ["green", "herbal", "aromatic", "galbanum"]],
  ["Rose and oud", "Opulent florals", ["rose", "oud", "agarwood", "saffron"]],
  ["Smoky woods & leather", "Dry & shadowy", ["smoky", "leather", "tobacco", "incense"]],
  ["Soft powdery florals", "Cloudlike", ["powdery", "iris", "violet", "musky"]],
] as const;

export function FragranceAtlas() {
  const [points, setPoints] = useState<AtlasPoint[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [house, setHouse] = useState("");
  const [decade, setDecade] = useState("");
  const [rating, setRating] = useState("");
  const [accord, setAccord] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<AtlasPoint | null>(null);
  const [highlighted, setHighlighted] = useState<AtlasPoint | null>(null);
  const [hovered, setHovered] = useState<AtlasPoint | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer = window.setInterval(() => {
      setLoadingProgress((value) =>
        Math.min(88, value + Math.max(1, (88 - value) * 0.08)),
      );
    }, 120);
    fetch("/data/fragrance-atlas.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Atlas data unavailable");
        return response.json() as Promise<{ points: AtlasPoint[] }>;
      })
      .then((payload) => {
        window.clearInterval(timer);
        timer = 0;
        setLoadingProgress(100);
        setPoints(payload.points);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        window.clearInterval(timer);
        timer = 0;
        setLoadError(error instanceof Error ? error.message : "Atlas data unavailable");
      });
    return () => {
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const facets = useMemo(() => buildFacets(points), [points]);
  const filteredPoints = useMemo(() => {
    const minimumRating = Number(rating) || 0;
    const decadeStart = Number(decade) || 0;
    return points.filter((point) => {
      if (house && point.h !== house) return false;
      if (decadeStart && (point.yr < decadeStart || point.yr >= decadeStart + 10)) {
        return false;
      }
      if (minimumRating && point.rt < minimumRating) return false;
      if (accord && !point.a.some((item) => item.toLowerCase() === accord)) return false;
      if (note && !point.nt.some((item) => item.toLowerCase() === note)) return false;
      return true;
    });
  }, [accord, decade, house, note, points, rating]);

  const searchResults = useMemo(() => {
    if (deferredQuery.length < 2) return [];
    const matches: Array<{ point: AtlasPoint; score: number }> = [];
    for (const point of points) {
      const name = point.n.toLowerCase();
      const maker = point.h.toLowerCase();
      let score = 0;
      if (name === deferredQuery) score = 5;
      else if (name.startsWith(deferredQuery)) score = 4;
      else if (name.includes(deferredQuery)) score = 3;
      else if (maker.startsWith(deferredQuery)) score = 2;
      else if (maker.includes(deferredQuery)) score = 1;
      if (score) matches.push({ point, score: score * 1_000_000 + point.v });
    }
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((item) => item.point);
  }, [deferredQuery, points]);

  const clusters = useMemo(() => buildClusters(points), [points]);
  const activeFilterCount = [house, decade, rating, accord, note].filter(Boolean).length;
  const resetFilters = () => {
    setHouse("");
    setDecade("");
    setRating("");
    setAccord("");
    setNote("");
  };
  const focusPoint = useCallback((point: AtlasPoint) => {
    setHighlighted(point);
    setSelected(point);
    setHovered(null);
    setCamera({ x: point.x, y: point.y, zoom: 6 });
    setQuery(point.n);
  }, []);

  if (!points.length) {
    return (
      <section className="flex min-h-[68vh] flex-col items-center justify-center text-center">
        <div className="relative flex size-24 items-center justify-center rounded-full border border-border bg-card">
          <span className="absolute inset-3 animate-ping rounded-full border border-accent/30" />
          <Sparkle className="text-accent" size={34} weight="duotone" />
        </div>
        <h1 className="mt-7 text-3xl font-semibold">
          {loadError || "Plotting the fragrance world"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {loadError
            ? "Refresh to try loading the map again."
            : "Projecting notes, accords, and eras into two dimensions…"}
        </p>
        {!loadError ? (
          <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <Sparkle size={14} weight="fill" />
            Scent similarity map
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Fragrance Atlas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Explore {NUMBER.format(points.length)} fragrances by sensory
            neighborhood. Nearby points share notes, accords, era, and character.
          </p>
        </div>
        <div className="flex gap-6 border-l border-border pl-5 text-sm">
          <Stat value={NUMBER.format(filteredPoints.length)} label="Visible scents" />
          <Stat value={NUMBER.format(facets.houseCount)} label="Houses" />
          <Stat value="12D → 2D" label="PCA projection" />
        </div>
      </header>

      <section className="relative">
        <div className="relative z-30 mb-3">
          <label className="relative block">
            <span className="sr-only">Search the fragrance atlas</span>
            <MagnifyingGlass
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted"
              size={19}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  focusPoint(searchResults[0]);
                }
              }}
              placeholder="Find a fragrance or house…"
              className="h-13 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft/70 sm:pr-28"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 font-mono text-[0.65rem] uppercase tracking-widest text-muted sm:block">
              {NUMBER.format(points.length)} scents
            </span>
          </label>
          {deferredQuery.length >= 2 &&
          query.toLowerCase() !== selected?.n.toLowerCase() ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
              {searchResults.length ? (
                searchResults.map((point) => (
                  <button
                    key={point.i}
                    type="button"
                    onClick={() => focusPoint(point)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-card-hover"
                  >
                    <PointSwatch point={point} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{point.n}</span>
                      <span className="block truncate text-xs text-muted">
                        {point.h} {point.yr > 0 ? `· ${point.yr}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted">{formatRating(point.rt)}</span>
                    <CaretRight size={14} className="text-muted" />
                  </button>
                ))
              ) : (
                <p className="px-4 py-5 text-center text-sm text-muted">
                  No fragrance matches “{query}”
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside
            className={`${filtersOpen ? "block" : "hidden"} rounded-2xl border border-border bg-card p-4 lg:block`}
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Funnel size={16} weight="fill" className="text-accent" />
                Refine map
              </h2>
              {activeFilterCount ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="mt-5 space-y-4">
              <AtlasSelect label="House" value={house} onChange={setHouse}>
                <option value="">All houses</option>
                {facets.houses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({NUMBER.format(item.count)})
                  </option>
                ))}
              </AtlasSelect>
              <AtlasSelect label="Decade" value={decade} onChange={setDecade}>
                <option value="">All decades</option>
                {facets.decades.map((value) => (
                  <option key={value} value={value}>
                    {value}s
                  </option>
                ))}
              </AtlasSelect>
              <AtlasSelect label="Minimum rating" value={rating} onChange={setRating}>
                <option value="">Any rating</option>
                <option value="4.5">4.5 and up</option>
                <option value="4">4.0 and up</option>
                <option value="3.5">3.5 and up</option>
              </AtlasSelect>
              <AtlasSelect label="Accord" value={accord} onChange={setAccord}>
                <option value="">All accords</option>
                {facets.accords.map((item) => (
                  <option key={item.value} value={item.value}>
                    {titleCase(item.value)}
                  </option>
                ))}
              </AtlasSelect>
              <AtlasSelect label="Note" value={note} onChange={setNote}>
                <option value="">All notes</option>
                {facets.notes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </AtlasSelect>
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
                Reading the atlas
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">
                Each point is one fragrance. Color follows its leading accord;
                size reflects community interest.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
                {["fresh", "floral", "woody", "sweet", "spicy", "green"].map(
                  (item) => (
                    <span key={item} className="flex items-center gap-1.5 text-[0.68rem] text-muted">
                      <span className="size-2 rounded-full" style={{ background: COLORS[item] }} />
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
          </aside>

          <div className="relative min-h-[640px] overflow-hidden rounded-2xl border border-border bg-[#0f1311] shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at 20% 20%, rgba(87,126,105,.18), transparent 35%), radial-gradient(circle at 78% 68%, rgba(138,91,67,.15), transparent 38%), linear-gradient(#121713, #0d100f)",
              }}
            />
            <AtlasCanvas
              points={filteredPoints}
              clusters={clusters}
              camera={camera}
              setCamera={setCamera}
              selected={selected}
              highlighted={highlighted}
              onHover={(point, x, y) => {
                setHovered(point);
                setTooltip({ x, y });
              }}
              onSelect={setSelected}
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              className="absolute left-3 top-3 z-10 flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur lg:hidden"
            >
              <Funnel size={15} />
              Filters
              {activeFilterCount ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[0.65rem] text-[#17120a]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur">
              <MapButton
                label="Zoom in"
                onClick={() =>
                  setCamera((value) => ({ ...value, zoom: Math.min(18, value.zoom * 1.45) }))
                }
              >
                <Plus size={16} />
              </MapButton>
              <MapButton
                label="Zoom out"
                onClick={() =>
                  setCamera((value) => ({ ...value, zoom: Math.max(0.65, value.zoom / 1.45) }))
                }
              >
                <Minus size={16} />
              </MapButton>
              <MapButton label="Reset view" onClick={() => setCamera(INITIAL_CAMERA)}>
                <ArrowCounterClockwise size={16} />
              </MapButton>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.13em] text-white/65 backdrop-blur sm:flex">
              <ArrowsOutSimple size={13} />
              Drag to explore · Scroll to zoom
            </div>
            {hovered && hovered.i !== selected?.i ? (
              <div
                className="pointer-events-none absolute z-20 max-w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-white/15 bg-[#171b18]/95 px-3 py-2 text-white shadow-xl backdrop-blur"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <p className="truncate text-xs font-semibold">{hovered.n}</p>
                <p className="mt-0.5 truncate text-[0.68rem] text-white/60">
                  {hovered.h} {hovered.yr > 0 ? `· ${hovered.yr}` : ""}
                </p>
              </div>
            ) : null}
            {selected ? (
              <DetailCard point={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="pointer-events-none absolute bottom-5 right-5 hidden max-w-64 rounded-2xl border border-white/10 bg-black/40 p-4 text-white backdrop-blur md:block">
                <p className="text-sm font-semibold">Pick any point</p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  Open notes, accords, rating, and full fragrance profile.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AtlasCanvas({
  points,
  clusters,
  camera,
  setCamera,
  selected,
  highlighted,
  onHover,
  onSelect,
}: {
  points: AtlasPoint[];
  clusters: Cluster[];
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  selected: AtlasPoint | null;
  highlighted: AtlasPoint | null;
  onHover: (point: AtlasPoint | null, x: number, y: number) => void;
  onSelect: (point: AtlasPoint | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<ScreenPoint[]>([]);
  const sizeRef = useRef({ width: 1, height: 1, dpr: 1 });
  const dragRef = useRef<{
    x: number;
    y: number;
    camera: Camera;
    moved: boolean;
  } | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      setResizeTick((value) => value + 1);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const { width, height, dpr } = sizeRef.current;
    const unit = Math.min(width, height) * 0.43;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    drawGrid(context, width, height, unit, camera);
    const visible: ScreenPoint[] = [];
    const pointSize = camera.zoom < 1.3 ? 1.15 : Math.min(3.3, 1.1 + camera.zoom * 0.18);
    context.globalAlpha = camera.zoom < 1 ? 0.62 : 0.78;
    for (const point of points) {
      const screen = toScreen(point.x, point.y, camera, width, height, unit);
      if (
        screen.x < -8 ||
        screen.y < -8 ||
        screen.x > width + 8 ||
        screen.y > height + 8
      ) {
        continue;
      }
      const size = pointSize + Math.min(2.4, Math.log10(point.v + 1) * 0.32);
      context.fillStyle = colorForPoint(point);
      context.fillRect(screen.x - size / 2, screen.y - size / 2, size, size);
      visible.push({ point, ...screen });
    }
    context.globalAlpha = 1;
    if (camera.zoom < 3.2) {
      for (const cluster of clusters) {
        const screen = toScreen(cluster.x, cluster.y, camera, width, height, unit);
        if (
          screen.x < 80 ||
          screen.y < 45 ||
          screen.x > width - 80 ||
          screen.y > height - 45
        ) {
          continue;
        }
        drawClusterLabel(context, cluster, screen.x, screen.y, camera.zoom);
      }
    }
    for (const focus of [highlighted, selected]) {
      if (!focus) continue;
      const screen = toScreen(focus.x, focus.y, camera, width, height, unit);
      if (screen.x < 0 || screen.y < 0 || screen.x > width || screen.y > height) continue;
      context.beginPath();
      context.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
      context.strokeStyle = "#fff7de";
      context.lineWidth = 2;
      context.stroke();
      context.beginPath();
      context.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
      context.fillStyle = "#f5a400";
      context.fill();
    }
    visibleRef.current = visible;
  }, [camera, clusters, highlighted, points, resizeTick, selected]);

  const nearestPoint = (x: number, y: number) => {
    let nearest: ScreenPoint | null = null;
    let distance = 110;
    for (const screen of visibleRef.current) {
      const dx = screen.x - x;
      const dy = screen.y - y;
      const candidate = dx * dx + dy * dy;
      if (candidate < distance) {
        distance = candidate;
        nearest = screen;
      }
    }
    return nearest;
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-label={`Interactive map showing ${NUMBER.format(points.length)} fragrance points`}
        className="absolute inset-0 touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, camera, moved: false };
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          if (dragRef.current) {
            const dx = event.clientX - dragRef.current.x;
            const dy = event.clientY - dragRef.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
            const unit = Math.min(rect.width, rect.height) * 0.43;
            setCamera({
              ...dragRef.current.camera,
              x: dragRef.current.camera.x - dx / (unit * dragRef.current.camera.zoom),
              y: dragRef.current.camera.y - dy / (unit * dragRef.current.camera.zoom),
            });
            onHover(null, localX, localY);
            return;
          }
          const nearest = nearestPoint(localX, localY);
          event.currentTarget.style.cursor = nearest ? "pointer" : "grab";
          onHover(nearest?.point ?? null, localX, localY);
        }}
        onPointerUp={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const wasMoved = dragRef.current?.moved;
          dragRef.current = null;
          if (!wasMoved) {
            onSelect(
              nearestPoint(event.clientX - rect.left, event.clientY - rect.top)?.point ?? null,
            );
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          if (!dragRef.current) onHover(null, 0, 0);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const unit = Math.min(rect.width, rect.height) * 0.43;
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const worldX =
            camera.x + (pointerX - rect.width / 2) / (unit * camera.zoom);
          const worldY =
            camera.y + (pointerY - rect.height / 2) / (unit * camera.zoom);
          const nextZoom = Math.max(
            0.65,
            Math.min(18, camera.zoom * Math.exp(-event.deltaY * 0.0013)),
          );
          setCamera({
            zoom: nextZoom,
            x: worldX - (pointerX - rect.width / 2) / (unit * nextZoom),
            y: worldY - (pointerY - rect.height / 2) / (unit * nextZoom),
          });
        }}
      >
        Interactive fragrance similarity map.
      </canvas>
    </div>
  );
}

function DetailCard({ point, onClose }: { point: AtlasPoint; onClose: () => void }) {
  return (
    <article className="absolute bottom-3 right-3 z-20 w-[calc(100%-1.5rem)] max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#181c19]/95 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-start gap-3 border-b border-white/10 p-4">
        <div
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
          style={{ background: `${colorForPoint(point)}24` }}
        >
          <span
            className="size-3 rounded-full shadow-[0_0_16px_currentColor]"
            style={{ background: colorForPoint(point), color: colorForPoint(point) }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.13em] text-[#f5b73d]">
            {point.h}
          </p>
          <h2 className="mt-1 truncate font-display text-xl font-semibold">{point.n}</h2>
        </div>
        <button
          type="button"
          aria-label="Close fragrance details"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 text-xs text-white/65">
          {point.yr > 0 ? <span>{point.yr}</span> : null}
          {point.rt > 0 ? (
            <span className="flex items-center gap-1 text-[#f6cc61]">
              <Star size={13} weight="fill" />
              {point.rt.toFixed(1)}
            </span>
          ) : null}
          {point.v > 0 ? <span>{NUMBER.format(point.v)} votes</span> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {point.a.slice(0, 6).map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.68rem] text-white/75"
            >
              {titleCase(item)}
            </span>
          ))}
        </div>
        {point.nt.length ? (
          <p className="mt-4 line-clamp-2 text-xs leading-5 text-white/55">
            <span className="font-semibold text-white/75">Notes: </span>
            {point.nt.slice(0, 8).join(", ")}
          </p>
        ) : null}
        <Link
          href={`/fragrance/${point.s}`}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#17120a] transition hover:-translate-y-0.5"
        >
          View fragrance profile
          <CaretRight size={15} weight="bold" />
        </Link>
      </div>
    </article>
  );
}

function AtlasSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        {children}
      </select>
    </label>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-10 items-center justify-center border-b border-white/10 last:border-0 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 whitespace-nowrap text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </p>
    </div>
  );
}

function PointSwatch({ point }: { point: AtlasPoint }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
      style={{ background: colorForPoint(point), color: colorForPoint(point) }}
    />
  );
}

function buildFacets(points: AtlasPoint[]) {
  const houseCounts = new Map<string, number>();
  const accordCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  const decades = new Set<number>();
  for (const point of points) {
    houseCounts.set(point.h, (houseCounts.get(point.h) ?? 0) + 1);
    for (const item of point.a) accordCounts.set(item, (accordCounts.get(item) ?? 0) + 1);
    for (const item of point.nt) noteCounts.set(item, (noteCounts.get(item) ?? 0) + 1);
    if (point.yr >= 1900) decades.add(Math.floor(point.yr / 10) * 10);
  }
  const ranked = (counts: Map<string, number>, limit: number) =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  return {
    houseCount: houseCounts.size,
    houses: ranked(houseCounts, 250),
    accords: ranked(accordCounts, 100),
    notes: ranked(noteCounts, 160),
    decades: [...decades].sort((a, b) => b - a),
  };
}

function buildClusters(points: AtlasPoint[]): Cluster[] {
  return CLUSTERS.flatMap(([label, eyebrow, terms]) => {
    let x = 0;
    let y = 0;
    let weight = 0;
    for (const point of points) {
      const haystack = [...point.a, ...point.nt].join(" ").toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      if (hits < 2) continue;
      const pointWeight = 1 + Math.log10(point.v + 1);
      x += point.x * pointWeight;
      y += point.y * pointWeight;
      weight += pointWeight;
    }
    return weight ? [{ label, eyebrow, x: x / weight, y: y / weight }] : [];
  });
}

function toScreen(
  x: number,
  y: number,
  camera: Camera,
  width: number,
  height: number,
  unit: number,
) {
  return {
    x: (x - camera.x) * unit * camera.zoom + width / 2,
    y: (y - camera.y) * unit * camera.zoom + height / 2,
  };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  unit: number,
  camera: Camera,
) {
  const spacing = Math.max(42, unit * camera.zoom * 0.22);
  const originX = width / 2 - camera.x * unit * camera.zoom;
  const originY = height / 2 - camera.y * unit * camera.zoom;
  context.strokeStyle = "rgba(255,255,255,.035)";
  context.lineWidth = 1;
  context.beginPath();
  for (let x = ((originX % spacing) + spacing) % spacing; x < width; x += spacing) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = ((originY % spacing) + spacing) % spacing; y < height; y += spacing) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
}

function drawClusterLabel(
  context: CanvasRenderingContext2D,
  cluster: Cluster,
  x: number,
  y: number,
  zoom: number,
) {
  context.save();
  context.globalAlpha = Math.max(0.45, 1 - Math.max(0, zoom - 1.1) * 0.26);
  context.textAlign = "center";
  context.fillStyle = "rgba(9,12,10,.72)";
  context.strokeStyle = "rgba(255,255,255,.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x - 79, y - 24, 158, 48, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(245,183,61,.82)";
  context.font = "600 8px ui-monospace, monospace";
  context.fillText(cluster.eyebrow.toUpperCase(), x, y - 7);
  context.fillStyle = "rgba(255,255,255,.88)";
  context.font = "600 11px ui-sans-serif, system-ui";
  context.fillText(cluster.label, x, y + 10);
  context.restore();
}

function colorForPoint(point: AtlasPoint): string {
  for (const item of point.a) {
    const normalized = item.toLowerCase();
    if (COLORS[normalized]) return COLORS[normalized];
    for (const [key, color] of Object.entries(COLORS)) {
      if (normalized.includes(key)) return color;
    }
  }
  return "#a9b8ad";
}

function formatRating(value: number): string {
  return value > 0 ? `★ ${value.toFixed(1)}` : "Unrated";
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
