// ============================================================
// DisLogic — Waveform Viewer (diagrama de tiempos estilo GTKWave)
// Trazas escalón 1-bit, buses hexagonales con valor hex,
// eje de tiempo con zoom, flancos de clock y flotantes.
// ============================================================
"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Activity, Trash2, X } from "lucide-react";
import { useCircuit } from "@/lib/circuit/store";
import { pinsOf } from "@/components/circuit/circuit-node";
import type { ComponentInstance } from "@/lib/circuit/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ---------- constantes de diseño ----------
const AXIS_H = 24; // alto de la regla de tiempo
const ROW_H = 34; // alto de cada fila de señal
const LABEL_W = 104; // ancho de la columna de etiquetas
const COL_1 = "var(--alto)";
const COL_0 = "var(--bajo)";
const COL_Z = "var(--flotante)";
const COL_GRID = "var(--linea)";
const MAX_SEG = 260; // máx. segmentos por traza (decimación por paso)
const MAX_WINDOW = 2000; // máx. instantes visibles en la vista completa

type Zoom = "all" | "1000" | "200" | "50";
const ZOOMS: { id: Zoom; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "1000", label: "1k" },
  { id: "200", label: "200" },
  { id: "50", label: "50" },
];

const vColor = (v: number) => (v < 0 ? COL_Z : v === 0 ? COL_0 : COL_1);
const hex = (v: number) => `0x${v.toString(16).toUpperCase()}`;
const curText = (v: number | undefined, width: number) =>
  v === undefined || v < 0 ? "Z" : width > 1 ? hex(v) : String(v === 0 ? 0 : 1);

/** punto normalizado de una traza: t = ns (temporal) o nº de evento (ideal) */
interface WavePoint {
  t: number;
  value: number;
}

function fmtT(t: number, temporal: boolean, useUs: boolean): string {
  if (!temporal) return String(Math.round(t));
  if (useUs) {
    const us = t / 1000;
    return `${(us >= 100 ? us.toFixed(0) : us.toFixed(1)).replace(/\.0$/, "")}µs`;
  }
  return `${Math.round(t)}ns`;
}

function niceTicks(t0: number, t1: number, count = 4): number[] {
  const span = t1 - t0;
  if (!(span > 0)) return [];
  const rough = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1 + step * 1e-6; t += step) {
    out.push(Math.abs(t) < 1e-9 ? 0 : Math.round(t * 1e4) / 1e4);
  }
  return out;
}

/** Puntos (x, valor) de una traza dentro de la ventana visible, con decimación */
function buildPts(
  samples: WavePoint[],
  t0: number,
  span: number,
  plotW: number,
): { x: number; v: number }[] {
  if (samples.length === 0) return [];
  let start = 0;
  while (start < samples.length && samples[start].t < t0) start++;
  if (start > 0) start -= 1; // incluir la muestra previa para el nivel inicial
  let sel: WavePoint[] = samples.slice(start);
  if (sel.length > MAX_SEG) {
    const stride = Math.ceil(sel.length / MAX_SEG);
    const out: WavePoint[] = [];
    for (let i = 0; i < sel.length; i += stride) out.push(sel[i]);
    const last = sel[sel.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    sel = out;
  }
  const xAt = (t: number) => Math.max(0, Math.min(plotW, ((t - t0) / span) * plotW));
  const pts = sel.map((s) => ({ x: xAt(s.t), v: s.value }));
  if (pts[pts.length - 1].x < plotW - 0.01) {
    pts.push({ x: plotW, v: sel[sel.length - 1].value }); // extender el último nivel
  }
  return pts;
}

/** Traza escalón para señales de 1 bit (flotante = nivel medio punteado) */
function renderBits(
  pts: { x: number; v: number }[],
  top: number,
  mid: number,
  bot: number,
  plotW: number,
): ReactElement[] {
  const els: ReactElement[] = [];
  const yOf = (v: number) => (v === 1 ? top : v === 0 ? bot : mid);
  for (let i = 0; i < pts.length - 1; i++) {
    const v = pts[i].v;
    if (pts[i + 1].x - pts[i].x < 0.4) continue;
    els.push(
      <line
        key={`h${i}`}
        x1={pts[i].x}
        x2={pts[i + 1].x}
        y1={yOf(v)}
        y2={yOf(v)}
        stroke={vColor(v)}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeDasharray={v < 0 ? "3 2" : undefined}
      />,
    );
  }
  for (let i = 1; i < pts.length; i++) {
    const yA = yOf(pts[i - 1].v);
    const yB = yOf(pts[i].v);
    if (Math.abs(yA - yB) < 0.5 || pts[i].x >= plotW - 0.01) continue;
    els.push(
      <line key={`v${i}`} x1={pts[i].x} x2={pts[i].x} y1={yA} y2={yB} stroke={vColor(pts[i].v)} strokeWidth={1.2} />,
    );
  }
  return els;
}

/** Traza de bus estilo GTKWave: envolvente hexagonal con valor en hex */
function renderBus(
  pts: { x: number; v: number }[],
  top: number,
  mid: number,
  bot: number,
  plotW: number,
): ReactElement[] {
  const els: ReactElement[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x;
    const x1 = pts[i + 1].x;
    const v = pts[i].v;
    const w = x1 - x0;
    if (w < 0.5) continue;
    if (v < 0) {
      els.push(
        <line key={`b${i}`} x1={x0} x2={x1} y1={mid} y2={mid} stroke={COL_Z} strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />,
      );
      continue;
    }
    const m = Math.min(4, w / 2);
    els.push(
      <polygon
        key={`b${i}`}
        points={`${x0},${mid} ${x0 + m},${top} ${x1 - m},${top} ${x1},${mid} ${x1 - m},${bot} ${x0 + m},${bot}`}
        fill={v === 0 ? "rgba(255,68,68,0.10)" : "rgba(0,255,136,0.10)"}
        stroke={vColor(v)}
        strokeWidth={1}
      />,
    );
    if (w > 20) {
      const label = w > 36 ? hex(v) : v.toString(16).toUpperCase();
      els.push(
        <text
          key={`t${i}`}
          x={(x0 + x1) / 2}
          y={mid + 3}
          textAnchor="middle"
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--tinta)"
        >
          {label}
        </text>,
      );
    }
  }
  return els;
}

export function WaveformPanel() {
  const components = useCircuit((s) => s.components);
  const probes = useCircuit((s) => s.probes);
  const waveHistory = useCircuit((s) => s.waveHistory);
  const pinValues = useCircuit((s) => s.pinValues);
  const temporal = useCircuit((s) => s.temporal);
  const simVersion = useCircuit((s) => s.simVersion);
  const setProbes = useCircuit((s) => s.setProbes);
  const clearWaveHistory = useCircuit((s) => s.clearWaveHistory);
  const pushLog = useCircuit((s) => s.pushLog);

  const [pick, setPick] = useState("");
  const [zoom, setZoom] = useState<Zoom>("all");
  const [plotW, setPlotW] = useState(160);
  const plotBox = useRef<HTMLDivElement>(null);

  // medir el ancho real del área de trazas (viewBox 1 unidad = 1 px)
  useEffect(() => {
    const el = plotBox.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setPlotW(Math.max(48, Math.round(w) - 2));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // agrupar historial por señal (O(n) por tick del simulador).
  // En modo ideal el motor no avanza el tiempo (t=0 siempre): usamos el nº de
  // evento global como eje para que las trazas se repartan en el ancho.
  const groups = useMemo(() => {
    const g = new Map<string, WavePoint[]>();
    waveHistory.forEach((s, ord) => {
      const pt: WavePoint = { t: temporal ? s.t : ord, value: s.value };
      const arr = g.get(s.key);
      if (arr) arr.push(pt);
      else g.set(s.key, [pt]);
    });
    return g;
  }, [waveHistory, simVersion, temporal]);

  const compById = useMemo(() => {
    const m = new Map<string, ComponentInstance>();
    for (const c of components) m.set(c.id, c);
    return m;
  }, [components]);

  // filas activas, en el orden de probes
  const rows = useMemo(
    () =>
      probes.map((key) => {
        const i = key.indexOf(":");
        const compId = i >= 0 ? key.slice(0, i) : key;
        const pinId = i >= 0 ? key.slice(i + 1) : "out";
        const comp = compById.get(compId);
        const pin = comp ? pinsOf(comp.type, comp.props).find((p) => p.id === pinId) : undefined;
        return {
          key,
          name: comp ? (comp.label ?? comp.type) : "(eliminado)",
          pinName: pin?.name ?? pinId,
          width: pin?.width ?? 1,
          isClock: comp?.type === "CLOCK",
          samples: groups.get(key) ?? [],
        };
      }),
    [probes, compById, groups],
  );

  // candidatos: pines de salida de todos los componentes + entradas de OUT/Probe
  const candidates = useMemo(() => {
    const active = new Set(probes);
    const out: { key: string; label: string }[] = [];
    for (const c of components) {
      for (const p of pinsOf(c.type, c.props)) {
        if (p.direction !== "output" && c.type !== "OUTPUT_PIN" && c.type !== "PROBE") continue;
        const key = `${c.id}:${p.id}`;
        if (active.has(key)) continue;
        out.push({ key, label: `${c.label ?? c.type} · ${p.name}${p.width > 1 ? ` [${p.width}b]` : ""}` });
      }
    }
    return out;
  }, [components, probes]);

  // ventana de tiempo visible según zoom (últimos N instantes de evento)
  const win = useMemo(() => {
    const seen = new Set<number>();
    const times: number[] = [];
    for (const r of rows) {
      for (const s of r.samples) {
        if (!seen.has(s.t)) {
          seen.add(s.t);
          times.push(s.t);
        }
      }
    }
    if (times.length === 0) return null;
    const n = zoom === "all" ? MAX_WINDOW : Number(zoom);
    const t0 = times[Math.max(0, times.length - n)];
    const t1 = times[times.length - 1];
    const pad = (t1 - t0 || (temporal ? 10 : 1)) * 0.04;
    return { t0, t1: t1 + pad, span: t1 + pad - t0 };
  }, [rows, zoom, temporal]);

  const xOf = (t: number) => (win ? ((t - win.t0) / win.span) * plotW : 0);
  const ticks = win ? niceTicks(win.t0, win.t1, 5) : [];
  const useUs = temporal && !!win && win.t1 >= 10000;
  const H = AXIS_H + rows.length * ROW_H;

  // flancos de subida de los CLOCK probeados → líneas punteadas verticales
  const clockEdges = useMemo(() => {
    const xs: number[] = [];
    if (!win) return xs;
    for (const r of rows) {
      if (!r.isClock) continue;
      for (let i = 1; i < r.samples.length; i++) {
        if (r.samples[i].value === 1 && r.samples[i - 1].value === 0) {
          const x = ((r.samples[i].t - win.t0) / win.span) * plotW;
          if (x >= 0 && x <= plotW) xs.push(x);
        }
      }
    }
    return xs;
  }, [rows, win, plotW]);

  const addProbe = (key: string) => {
    if (key && !probes.includes(key)) {
      setProbes([...probes, key]);
      pushLog("info", `Sonda agregada al diagrama de ondas.`);
    }
    setPick("");
  };

  const clearHistory = () => {
    clearWaveHistory();
    pushLog("info", "Historial de ondas limpiado.");
  };

  // ---------- estado vacío: sin probes ----------
  if (probes.length === 0) {
    return (
      <div className="flex h-full flex-col bg-papel">
        <div className="flex items-center gap-1.5 px-2 pt-2">
          <Select value={pick} onValueChange={addProbe}>
            <SelectTrigger aria-label="Agregar señal" size="sm" className="min-w-0 flex-1 border-linea bg-hoja-2 text-[12px]">
              <SelectValue placeholder="+ Agregar señal…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {candidates.length === 0 ? (
                <div className="px-2 py-1.5 text-[12px] text-tinta-2">Agregá componentes al circuito…</div>
              ) : (
                candidates.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="text-[12px]">
                    {c.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-tinta-2 hover:text-fallo"
            onClick={clearHistory}
            disabled
            title="Limpiar historial de ondas"
            aria-label="Limpiar historial de ondas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-[14px] font-bold text-tinta">Todavía no hay señales</p>
          <p className="max-w-[240px] text-[13px] leading-relaxed text-tinta-2">Elegí una salida en el selector de arriba y empezá la simulación para ver su diagrama de tiempos.</p>
        </div>
      </div>
    );
  }

  // ---------- panel con probes ----------
  return (
    <div className="flex h-full flex-col bg-papel">
      {/* selector + limpiar */}
      <div className="flex items-center gap-1.5 px-2 pt-2">
        <Select value={pick} onValueChange={addProbe}>
          <SelectTrigger
            aria-label="Agregar señal"
            size="sm"
            className="min-w-0 flex-1 border-linea bg-hoja-2 text-[12px]"
            disabled={candidates.length === 0}
          >
            <SelectValue placeholder="+ Agregar señal…" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {candidates.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-tinta-2">Todas las señales ya están agregadas</div>
            ) : (
              candidates.map((c) => (
                <SelectItem key={c.key} value={c.key} className="text-[12px]">
                  {c.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-tinta-2 hover:text-fallo"
          onClick={clearHistory}
          disabled={waveHistory.length === 0}
          title="Limpiar historial de ondas"
          aria-label="Limpiar historial de ondas"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* probes activos (chips con ×) */}
      <div className="flex flex-wrap gap-1 px-2 pb-1 pt-1.5">
        {rows.map((r) => (
          <Badge
            key={r.key}
            variant="outline"
            className="max-w-full gap-1 border-linea bg-hoja-2 py-0 text-[11px] font-mono text-tinta"
          >
            <span className="truncate">
              {r.name}·{r.pinName}
            </span>
            <button
              onClick={() => setProbes(probes.filter((k) => k !== r.key))}
              className="text-tinta-2 hover:text-fallo"
              aria-label={`Quitar ${r.name} ${r.pinName}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>

      {waveHistory.length === 0 && (
        <p className="px-2 pb-1 text-[11px] leading-snug text-tinta-2">
          Agregá señales y corré la simulación (▶) o presioná Step para registrar cambios.
        </p>
      )}

      {/* etiquetas + SVG de trazas */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex pb-1">
          {/* columna de etiquetas */}
          <div className="shrink-0" style={{ width: LABEL_W }}>
            <div style={{ height: AXIS_H }} className="flex items-end">
              <span className="pl-1.5 text-[11px] text-tinta-2">señal</span>
            </div>
            {rows.map((r, ri) => {
              const v = pinValues[r.key];
              return (
                <div
                  key={r.key}
                  style={{ height: ROW_H }}
                  className={cn(
                    "flex flex-col justify-center gap-1 px-1.5",
                    ri < rows.length - 1 && "border-b border-linea",
                  )}
                >
                  <span className="truncate font-mono text-[11px] leading-none text-tinta" title={`${r.name} · ${r.pinName}`}>
                    {r.isClock ? "" : ""}
                    {r.name}
                  </span>
                  <span className="truncate font-mono text-[11px] leading-none" title={`${r.pinName} = ${curText(v, r.width)}`}>
                    <span className="text-tinta-2">{r.pinName}</span>{" "}
                    <span style={{ color: vColor(v === undefined ? -1 : v) }}>{curText(v, r.width)}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* trazas */}
          <div ref={plotBox} className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${plotW} ${H}`}
              width="100%"
              height={H}
              className="block"
              role="img"
              aria-label="Diagrama de tiempos"
            >
              {/* fondo del área de trazas */}
              <rect x={0} y={AXIS_H} width={plotW} height={Math.max(0, H - AXIS_H)} fill="var(--hoja)" stroke="var(--linea)" />

              {/* grid vertical + ticks del eje de tiempo */}
              <line x1={0} x2={plotW} y1={AXIS_H} y2={AXIS_H} stroke={COL_GRID} />
              {ticks.map((t, i) => {
                const x = xOf(t);
                if (x < -0.5 || x > plotW + 0.5) return null;
                return (
                  <g key={`tk${i}`}>
                    <line x1={x} x2={x} y1={AXIS_H + 1} y2={Math.max(AXIS_H + 1, H - 1)} stroke={COL_GRID} />
                    <line x1={x} x2={x} y1={AXIS_H - 4} y2={AXIS_H} stroke="var(--linea-fuerte)" />
                    <text
                      x={Math.min(Math.max(x, 10), Math.max(10, plotW - 10))}
                      y={10}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      fill="var(--tinta-2)"
                    >
                      {fmtT(t, temporal, useUs)}
                    </text>
                  </g>
                );
              })}
              {!temporal && (
                <text x={plotW - 2} y={10} textAnchor="end" fontSize={10} fill="var(--tinta-2)" fontFamily="var(--font-mono)">
                  paso
                </text>
              )}

              {/* flancos de clock */}
              {clockEdges.map((x, i) => (
                <line
                  key={`clk${i}`}
                  x1={x}
                  x2={x}
                  y1={AXIS_H + 1}
                  y2={Math.max(AXIS_H + 1, H - 1)}
                  stroke="rgba(148,163,184,0.22)"
                  strokeDasharray="2 3"
                />
              ))}

              {/* separadores de fila */}
              {rows.map(
                (_, i) =>
                  i < rows.length - 1 && (
                    <line
                      key={`rs${i}`}
                      x1={0}
                      x2={plotW}
                      y1={AXIS_H + (i + 1) * ROW_H}
                      y2={AXIS_H + (i + 1) * ROW_H}
                      stroke="var(--linea)"
                    />
                  ),
              )}

              {/* trazas */}
              {rows.map((r, ri) => {
                const top = AXIS_H + ri * ROW_H + 6;
                const bot = AXIS_H + (ri + 1) * ROW_H - 6;
                const mid = (top + bot) / 2;
                if (!win || r.samples.length === 0) {
                  return (
                    <g key={r.key}>
                      <line x1={1} x2={plotW - 1} y1={mid} y2={mid} stroke={COL_Z} strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
                    </g>
                  );
                }
                const pts = buildPts(r.samples, win.t0, win.span, plotW);
                return <g key={r.key}>{r.width > 1 ? renderBus(pts, top, mid, bot, plotW) : renderBits(pts, top, mid, bot, plotW)}</g>;
              })}
            </svg>
          </div>
        </div>
      </ScrollArea>

      {/* pie: zoom + contador de muestras */}
      <div className="mt-auto flex items-center justify-between border-t border-linea px-2 py-1">
        <div className="flex items-center gap-0.5" role="group" aria-label="Zoom horizontal">
          {ZOOMS.map((z) => (
            <button
              key={z.id}
              onClick={() => setZoom(z.id)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                zoom === z.id ? "bg-sel-suave text-tinta" : "text-tinta-2 hover:text-tinta",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-tinta-2">{waveHistory.length} muestras</span>
      </div>
    </div>
  );
}
