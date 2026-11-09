// ============================================================
// DisLogic — Panel derecho: Herramienta de Mapa de Karnaugh
// Minimización SOP/POS (Quine-McCluskey), agrupamientos con
// colores, don't cares, síntesis en canvas y sección educativa
// (mintermos vs. maxtermos — Módulo 2, Diseño Lógico UTN).
// ============================================================
"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Zap } from "lucide-react";
import { useCircuit } from "@/lib/circuit/store";
import { minimize, grayOrder, parseMintermList, VAR_NAMES_4 } from "@/lib/circuit/karnaugh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// ---------------- helpers / datos ----------------

/** Resaltado de un grupo sobre una celda: borde en los lados que son
 *  frontera del grupo (con envolvente del mapa) + fondo translúcido. */
interface Overlay {
  key: string;
  color: string;
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

function overlayStyle(o: Overlay): CSSProperties {
  const s: CSSProperties = { background: `${o.color}24` };
  if (o.top) s.borderTop = `2px solid ${o.color}`;
  if (o.bottom) s.borderBottom = `2px solid ${o.color}`;
  if (o.left) s.borderLeft = `2px solid ${o.color}`;
  if (o.right) s.borderRight = `2px solid ${o.color}`;
  if (o.top && o.left) s.borderTopLeftRadius = 6;
  if (o.top && o.right) s.borderTopRightRadius = 6;
  if (o.bottom && o.left) s.borderBottomLeftRadius = 6;
  if (o.bottom && o.right) s.borderBottomRightRadius = 6;
  return s;
}

/** Ejemplos típicos de final (Módulo 2). */
const FINAL_EXAMPLES = [
  { id: "f1", minterms: "0,2,4,6,8,9,10,11,15" },
  { id: "f2", minterms: "1,5,7,9,13,14,15" },
  { id: "f3", minterms: "1,3,5,7,8,10,12,14" },
  { id: "f4", minterms: "0,4,5,8,12,13" },
  { id: "f5", minterms: "0,1,2,3,8,10,12" },
];

const bin = (v: number, bits: number) => v.toString(2).padStart(bits, "0");

// ---------------- panel ----------------

export function KmapPanel() {
  const [nVars, setNVars] = useState(4);
  const [mintermsStr, setMintermsStr] = useState("0,2,4,6,8,9,10,11,15");
  const [dontcaresStr, setDontcaresStr] = useState("");

  // --- parseo + validación (fuera de rango → ignorado) ---
  const parsed = useMemo(() => {
    const total = 1 << nVars;
    const valid = (v: number) => Number.isInteger(v) && v >= 0 && v < total;
    const rawM = parseMintermList(mintermsStr);
    const rawD = parseMintermList(dontcaresStr);
    const minterms = [...new Set(rawM.filter(valid))].sort((a, b) => a - b);
    const dontcares = [...new Set(rawD.filter(valid))].filter((v) => !minterms.includes(v)).sort((a, b) => a - b);
    const ignored = [...new Set([...rawM, ...rawD].filter((v) => !valid(v)))].sort((a, b) => a - b);
    return { minterms, dontcares, ignored };
  }, [nVars, mintermsStr, dontcaresStr]);

  const res = useMemo(
    () => minimize(parsed.minterms, parsed.dontcares, nVars),
    [parsed.minterms, parsed.dontcares, nVars],
  );

  // --- geometría del mapa: filas/columnas en código Gray ---
  const grid = useMemo(() => {
    const rowBits = Math.min(2, nVars - 1);
    const colBits = nVars - rowBits;
    const rowIdx = grayOrder(rowBits);
    const colIdx = grayOrder(colBits);
    const rows = rowIdx.length;
    const cols = colIdx.length;
    const cellMap = new Map<number, { r: number; c: number }>();
    rowIdx.forEach((rv, r) => colIdx.forEach((cv, c) => cellMap.set((rv << colBits) | cv, { r, c })));
    const mAt = (r: number, c: number) =>
      (rowIdx[((r % rows) + rows) % rows] << colBits) | colIdx[((c % cols) + cols) % cols];
    return { rowBits, colBits, rowIdx, colIdx, cellMap, mAt };
  }, [nVars]);

  // --- overlays por celda (fronteras de cada grupo, con wrap) ---
  const overlays = useMemo(() => {
    const map = new Map<number, Overlay[]>();
    res.groups.forEach((g, gi) => {
      const gset = new Set(g.minterms);
      for (const m of g.minterms) {
        const pos = grid.cellMap.get(m);
        if (!pos) continue;
        const o: Overlay = {
          key: `${gi}:${g.label}`,
          color: g.color,
          top: !gset.has(grid.mAt(pos.r - 1, pos.c)),
          bottom: !gset.has(grid.mAt(pos.r + 1, pos.c)),
          left: !gset.has(grid.mAt(pos.r, pos.c - 1)),
          right: !gset.has(grid.mAt(pos.r, pos.c + 1)),
        };
        const arr = map.get(m) ?? [];
        arr.push(o);
        map.set(m, arr);
      }
    });
    return map;
  }, [res, grid]);

  const onesSet = useMemo(() => new Set(parsed.minterms), [parsed.minterms]);
  const dcSet = useMemo(() => new Set(parsed.dontcares), [parsed.dontcares]);

  const cellValue = (m: number): "1" | "0" | "X" =>
    onesSet.has(m) ? "1" : dcSet.has(m) ? "X" : "0";

  /** toggle 0 → 1 → X → 0 (sincronizado con los campos de texto) */
  const toggleCell = (m: number) => {
    const v = cellValue(m);
    const ones = parsed.minterms.filter((x) => x !== m);
    const dcs = parsed.dontcares.filter((x) => x !== m);
    if (v === "1") dcs.push(m);
    else if (v === "0") ones.push(m);
    setMintermsStr(ones.sort((a, b) => a - b).join(","));
    setDontcaresStr(dcs.sort((a, b) => a - b).join(","));
  };

  const loadExample = (m: string) => {
    setNVars(4);
    setMintermsStr(m);
    setDontcaresStr("");
  };

  const synthesize = () => {
    const { synthesizeFromMinterms, pushLog } = useCircuit.getState();
    synthesizeFromMinterms(parsed.minterms, parsed.dontcares, nVars);
    pushLog("info", `Karnaugh: SOP = ${res.sop} · POS = ${res.pos}`);
  };

  const isEmpty = parsed.minterms.length === 0;
  const rowNames = VAR_NAMES_4.slice(0, grid.rowBits).join("");
  const colNames = VAR_NAMES_4.slice(grid.rowBits, nVars).join("");
  const cellSize = nVars === 4 ? 40 : nVars === 3 ? 44 : 52;
  const rowHeadW = grid.rowBits === 1 ? 26 : 36;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-2.5">
        {/* ---------- entrada ---------- */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[12px] font-medium text-tinta-2">Variables</Label>
            <Select value={String(nVars)} onValueChange={(v) => setNVars(Number(v))}>
              <SelectTrigger aria-label="Cantidad de variables" className="h-7 w-[108px] border-linea bg-hoja text-[12px] text-tinta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-linea bg-hoja-2">
                {[2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-[11px] text-tinta">
                    {n} var · {VAR_NAMES_4.slice(0, n).join("")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[12px] text-tinta-2">Mintermos F=Σm(…) — F=1</Label>
            <Input
              value={mintermsStr}
              onChange={(e) => setMintermsStr(e.target.value)}
              placeholder="0,1,2,3,8,10,12"
              className="h-7 border-linea bg-hoja font-mono text-[11px] text-tinta placeholder:text-tinta-2"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[12px] text-tinta-2">Don't cares (X) — opcional</Label>
            <Input
              value={dontcaresStr}
              onChange={(e) => setDontcaresStr(e.target.value)}
              placeholder="ej: 5,7"
              className="h-7 border-linea bg-hoja font-mono text-[11px] text-tinta placeholder:text-tinta-2"
            />
          </div>
          {parsed.ignored.length > 0 && (
            <p className="text-[12px] leading-snug text-aviso">
              Fuera de rango (ignorados): <span className="font-mono">{parsed.ignored.join(", ")}</span> — válidos: 0…{(1 << nVars) - 1}
            </p>
          )}
          {!isEmpty && (
            <p className="break-all font-mono text-[11px] text-tinta-2">
              F = Σm({parsed.minterms.join(",")})
              {parsed.dontcares.length > 0 ? ` + d(${parsed.dontcares.join(",")})` : ""}
            </p>
          )}
          <div>
            <p className="mb-1 text-[11px] text-tinta-2">Ejemplos de final</p>
            <div className="flex flex-wrap gap-1">
              {FINAL_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => loadExample(ex.minterms)}
                  title={`Cargar F = Σm(${ex.minterms})`}
                  className="rounded border border-linea bg-hoja px-1.5 py-0.5 font-mono text-[11px] text-tinta-2 transition-colors hover:border-sel hover:text-tinta"
                >
                  {`F={${ex.minterms}}`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- estado vacío ---------- */}
        {isEmpty && (
          <div className="rounded-sm border border-dashed border-linea bg-hoja p-3 text-center">
            <p className="text-[11px] font-medium text-tinta">Sin mintérminos</p>
            <p className="mt-1 text-[12px] leading-relaxed text-tinta-2">
              Ingresá los mintérminos donde F=1 (ej: <span className="font-mono">0,1,2,3,8,10,12</span>),
              don't cares aparte, o cargá un ejemplo. También podés hacer clic en las celdas del mapa.
            </p>
          </div>
        )}

        {/* ---------- mapa ---------- */}
        <section>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-[12px] font-medium text-tinta-2">Mapa de Karnaugh</Label>
            <span className="text-[11px] text-tinta-2">clic: 0→1→X→0</span>
          </div>
          <div className="flex justify-center">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-linea bg-hoja-2 px-1 text-center font-mono text-[11px] font-normal text-tinta"
                  >
                    {rowNames}\{colNames}
                  </th>
                  <th
                    colSpan={grid.colIdx.length}
                    className="border border-linea bg-hoja-2 px-1 font-mono text-[11px] font-medium text-tinta"
                  >
                    {colNames}
                  </th>
                </tr>
                <tr>
                  {grid.colIdx.map((cv) => (
                    <th
                      key={cv}
                      style={{ width: cellSize }}
                      className="border border-linea bg-hoja-2 py-0.5 font-mono text-[11px] font-normal text-tinta-2"
                    >
                      {bin(cv, grid.colBits)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rowIdx.map((rv) => (
                  <tr key={rv}>
                    <th
                      style={{ width: rowHeadW }}
                      className="border border-linea bg-hoja-2 px-0.5 font-mono text-[11px] font-normal text-tinta-2"
                    >
                      {bin(rv, grid.rowBits)}
                    </th>
                    {grid.colIdx.map((cv) => {
                      const m = (rv << grid.colBits) | cv;
                      const v = cellValue(m);
                      return (
                        <td
                          key={cv}
                          style={{ width: cellSize, height: cellSize }}
                          className="relative border border-linea bg-hoja p-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCell(m)}
                            title={`m${m} = ${v} (clic para cambiar)`}
                            className="relative flex h-full w-full cursor-pointer select-none items-center justify-center transition-colors hover:bg-white/5"
                          >
                            <span className="sr-only">Minitérmino</span>
                            {(overlays.get(m) ?? []).map((o) => (
                              <div key={o.key} className="pointer-events-none absolute inset-0" style={overlayStyle(o)} />
                            ))}
                            <span
                              className={`relative z-10 font-mono text-xs leading-none ${
                                v === "1"
                                  ? "font-bold text-alto"
                                  : v === "X"
                                    ? "font-semibold text-aviso"
                                    : "text-tinta-2"
                              }`}
                            >
                              {v}
                            </span>
                            <span className="absolute left-0.5 top-0.5 z-10 font-mono text-[11px] leading-none text-tinta-2">
                              {m}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- resultados ---------- */}
        {!isEmpty && (
          <section className="space-y-1.5">
            <Label className="text-[12px] font-medium text-tinta-2">Resultados</Label>
            <div className="space-y-2 rounded-sm border border-linea bg-hoja p-2">
              <div>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-tinta-2">SOP mínima</span>
                  <Badge className="border border-sel bg-sel-suave px-1 py-0 text-[11px] font-normal text-tinta">
                    AND-OR-Invert
                  </Badge>
                </div>
                <p className="break-words font-mono text-[11px] font-medium text-tinta">F = {res.sop}</p>
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-tinta-2">POS mínima</span>
                  <Badge variant="outline" className="border border-linea-fuerte bg-hoja-2 px-1 py-0 text-[11px] font-normal text-tinta">
                    OR-AND
                  </Badge>
                </div>
                <p className="break-words font-mono text-[11px] font-medium text-tinta">F = {res.pos}</p>
              </div>
              <div className="flex gap-3 border-t border-linea pt-1.5 text-[11px] text-tinta-2">
                <span>
                  Implicantes primos: <span className="font-mono text-tinta">{res.primeCount}</span>
                </span>
                <span>
                  Esenciales: <span className="font-mono text-tinta">{res.essentialCount}</span>
                </span>
              </div>
            </div>

            {/* leyenda de agrupamientos */}
            {res.groups.length > 0 && (
              <div className="space-y-1 rounded-sm border border-linea bg-hoja p-2">
                <p className="text-[11px] text-tinta-2">
                  Agrupamientos ({res.groups.length})
                </p>
                {res.groups.map((g, gi) => (
                  <div key={`${gi}:${g.label}`} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm border"
                      style={{ background: `${g.color}33`, borderColor: g.color }}
                    />
                    <span className="font-mono text-[12px] text-tinta">{g.label}</span>
                    <span className="break-all font-mono text-[11px] text-tinta-2">m({g.minterms.join(",")})</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              size="sm"
              onClick={synthesize}
              disabled={isEmpty}
              className="h-8 w-full bg-sel-suave text-xs font-medium text-papel hover:bg-sel-suave"
            >
              <Zap className="size-3.5" />
              Sintetizar en canvas
            </Button>
          </section>
        )}

        {/* ---------- sección educativa ---------- */}
        <Accordion type="single" collapsible className="rounded-sm border border-linea bg-hoja px-2">
          <AccordionItem value="edu" className="border-b-0">
            <AccordionTrigger className="py-2 text-[12px] font-medium text-tinta hover:no-underline">
              Mintermos vs. Maxtermos
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-2.5 text-[12px] leading-relaxed text-tinta-2">
              <p>
                <span className="font-medium text-tinta">Mintermo mᵢ:</span> fila de la tabla de verdad donde la
                función vale 1. Es un producto (AND) de las n variables — hay <em>un único mᵢ por fila</em>.
                F = Σ mᵢ suma (OR) los mintermos donde F=1.
              </p>
              <p>
                <span className="font-medium text-tinta">Maxtermo Mᵢ:</span> el complemento — fila donde F=0.
                Es una suma (OR) con cada variable negada respecto del mᵢ de esa fila, y
                F = Π Mᵢ multiplica (AND) los maxtermos donde F=0.
              </p>
              <p className="border-t border-linea pt-1.5 font-mono text-[11px] text-tinta-2">
                Mᵢ = (mᵢ)&apos; &nbsp;→&nbsp; m₂ = A·B&apos;·C ⟺ M₂ = A&apos;+B+C
              </p>
              <p className="text-tinta-2">
                Pregunta típica de final: dada una fila i, pasá de mᵢ a Mᵢ negando cada literal y elegí Σ para los
                1s o Π para los 0s.
              </p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="uso" className="border-b-0">
            <AccordionTrigger className="py-2 text-[12px] font-medium text-tinta hover:no-underline">
              Cómo leer el mapa
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-2.5 text-[12px] leading-relaxed text-tinta-2">
              <p>
                Filas y columnas se numeran en <span className="text-tinta">código Gray</span>
                {" "}(00·01·11·10): dos celdas vecinas difieren en una sola variable, incluso entre el borde derecho
                y el izquierdo — el mapa &quot;enrolla&quot;.
              </p>
              <p>
                Cada grupo de color es un implicante primo de la SOP mínima: agrupá 1, 2, 4, 8… celdas vecinas y
                eliminá las variables que cambian dentro del grupo (las que quedan forman el término).
              </p>
              <p>
                Las celdas <span className="font-semibold text-aviso">X</span> (don&apos;t cares) valen lo que
                convenga: sirven para agrandar grupos pero no es obligatorio cubrirlas.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  );
}
