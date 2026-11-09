// ============================================================
// DisLogic — Panel derecho: propiedades del componente seleccionado
// Incluye editores especiales: RAM hex, PLA (planos AND/OR),
// LUT (tabla programable), ROM (contenido)
// ============================================================
"use client";

import { useMemo } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { getDef } from "@/lib/circuit/catalog";
import type { ComponentInstance, PropField } from "@/lib/circuit/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------- editores custom ----------------

function HexValueEditor({
  values,
  onChange,
  wordBits,
  maxCells,
  shownCells,
}: {
  values: number[];
  onChange: (v: number[]) => void;
  wordBits: number;
  maxCells: number;
  shownCells: number;
}) {
  const mask = (1 << wordBits) - 1;
  const rows = Math.min(shownCells, maxCells);
  return (
    <div className="max-h-56 overflow-y-auto rounded border border-linea">
      <table className="w-full font-mono text-[12px]">
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-b border-linea">
              <td className="px-1.5 py-0.5 text-tinta">{i.toString(16).toUpperCase().padStart(2, "0")}</td>
              <td className="px-0.5 py-0.5">
                <input
                  value={(values[i] ?? 0).toString(16).toUpperCase()}
                  onChange={(e) => {
                    const next = [...values];
                    const parsed = parseInt(e.target.value, 16);
                    next[i] = isNaN(parsed) ? 0 : parsed & mask;
                    onChange(next);
                  }}
                  className="w-12 rounded bg-hoja px-1 text-right text-tinta outline-none ring-sel focus:ring-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LutEditor({ table, nIn, onChange }: { table: number[]; nIn: number; onChange: (t: number[]) => void }) {
  const rows = 1 << nIn;
  return (
    <div className="rounded border border-linea p-2">
      <div className="mb-1 grid grid-cols-[1fr_auto] gap-x-3 text-[12px] text-tinta-2">
        <span>Entrada I{nIn - 1}…I0</span>
        <span>Salida</span>
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto">
        {Array.from({ length: rows }, (_, m) => {
          const bits = Array.from({ length: nIn }, (_, i) => (m >> (nIn - 1 - i)) & 1);
          return (
            <div key={m} className="flex items-center justify-between rounded bg-hoja px-2 py-1">
              <span className="font-mono text-[12px] text-tinta-2">
                {bits.join("")}
                <span className="ml-2 text-tinta-2">m{m}</span>
              </span>
              <button
                className={`h-5 w-8 rounded font-mono text-[12px] font-bold transition-colors ${
                  table[m] === 1 ? "bg-alto/15 text-alto ring-1 ring-alto" : "text-tinta-2 ring-1 ring-linea-fuerte"
                }`}
                onClick={() => {
                  const next = [...table];
                  next[m] = table[m] === 1 ? 0 : 1;
                  onChange(next);
                }}
              >
                {table[m] === 1 ? "1" : "0"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaEditor({ andTerms, nIn, nOut, onChange }: { andTerms: number[][]; nIn: number; nOut: number; onChange: (t: number[][]) => void }) {
  const setCell = (t: number, i: number, v: number) => {
    const next = andTerms.map((r) => [...r]);
    next[t][i] = v;
    onChange(next);
  };
  const colors: Record<number, string> = { 0: "bg-sel-suave text-tinta ring-sel", 1: "bg-aviso/15 text-aviso ring-aviso", "-1": "bg-hoja-2 text-tinta-2 ring-linea-fuerte" };
  const labels: Record<number, string> = { 0: "A", 1: "N", "-1": "·" };
  return (
    <div className="rounded border border-linea p-2">
      <p className="mb-1.5 text-[11px] leading-tight text-tinta-2">
        Plano AND: <span className="text-tinta">A</span> = directa · <span className="text-aviso">N</span> = negada · <span className="text-tinta-2">·</span> = no conectada
      </p>
      <div className="overflow-x-auto">
        <table className="font-mono text-[11px]">
          <thead>
            <tr className="text-tinta-2">
              <th className="px-1">T</th>
              {Array.from({ length: nIn }, (_, i) => (
                <th key={i} className="px-1">I{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {andTerms.map((term, t) => (
              <tr key={t}>
                <td className="px-1 text-tinta-2">P{t}</td>
                {Array.from({ length: nIn }, (_, i) => {
                  const v = term[i] ?? -1;
                  return (
                    <td key={i} className="p-0.5">
                      <button
                        className={`h-4.5 w-4.5 h-5 w-5 rounded text-[11px] font-bold ring-1 ${colors[v] ?? colors[-1]}`}
                        onClick={() => setCell(t, i, v === -1 ? 0 : v === 0 ? 1 : -1)}
                      >
                        {labels[v] ?? "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-tinta-2">{nOut} salida(s) OR conectables a los términos P…</p>
    </div>
  );
}

// ---------------- campo genérico ----------------

function PropFieldEditor({ field, value, onChange, comp }: { field: PropField; value: unknown; onChange: (v: unknown) => void; comp: ComponentInstance }) {
  switch (field.kind) {
    case "select":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-tinta-2">{field.label}</Label>
          <Select
            value={String(value)}
            onValueChange={(v) => {
              const opt = field.options.find((o) => String(o.value) === v);
              onChange(opt ? opt.value : v);
            }}
          >
            <SelectTrigger className="h-8 border-linea bg-hoja text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-linea bg-hoja-2 text-tinta">
              {field.options.map((o) => (
                <SelectItem key={String(o.value)} value={String(o.value)} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-tinta-2">
            {field.label} {field.suffix && <span className="text-tinta-2">({field.suffix})</span>}
          </Label>
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={typeof value === "number" ? value : 0}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="h-8 border-linea bg-hoja font-mono text-xs text-tinta"
          />
        </div>
      );
    case "toggle":
      if (field.key === "_clickHint") {
        return <p className="text-[13px] text-tinta-2">Al simular, tocá el interruptor para cambiar entre 0 y 1.</p>;
      }
      return (
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-tinta-2">{field.label}</Label>
          <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
        </div>
      );
    case "text":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-tinta-2">{field.label}</Label>
          <Input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 border-linea bg-hoja font-mono text-xs text-tinta"
          />
        </div>
      );
    case "bits": {
      const w = (comp.props.bits as number) ?? 1;
      const num = typeof value === "number" ? value : 0;
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-tinta-2">{field.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={(1 << w) - 1}
              value={num}
              onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
              className="h-8 w-20 border-linea bg-hoja font-mono text-xs text-tinta"
            />
            <span className="font-mono text-[12px] text-tinta">0b{num.toString(2).padStart(w, "0")}</span>
          </div>
        </div>
      );
    }
    case "custom": {
      if (field.key === "table") {
        return (
          <div className="space-y-1">
            <Label className="text-[11px] text-tinta-2">{field.label}</Label>
            <LutEditor table={(value as number[]) ?? []} nIn={(comp.props.nIn as number) ?? 3} onChange={onChange} />
          </div>
        );
      }
      if (field.key === "contents" && comp.type === "ROM") {
        const ab = (comp.props.addrBits as number) ?? 3;
        return (
          <div className="space-y-1">
            <Label className="text-[11px] text-tinta-2">{field.label}</Label>
            <HexValueEditor values={(value as number[]) ?? []} wordBits={(comp.props.dataBits as number) ?? 6} maxCells={1 << ab} shownCells={1 << ab} onChange={onChange} />
          </div>
        );
      }
      if (field.key === "contents" && comp.type === "RAM") {
        const ab = (comp.props.addrBits as number) ?? 8;
        return (
          <div className="space-y-1">
            <Label className="text-[11px] text-tinta-2">
              {field.label} <span className="text-tinta-2">(las escrituras en simulación se guardan aparte)</span>
            </Label>
            <HexValueEditor values={(value as number[]) ?? []} wordBits={(comp.props.dataBits as number) ?? 8} maxCells={1 << ab} shownCells={Math.min(1 << ab, 32)} onChange={onChange} />
          </div>
        );
      }
      if (field.key === "andTerms") {
        return (
          <div className="space-y-1">
            <Label className="text-[11px] text-tinta-2">{field.label}</Label>
            <PlaEditor
              andTerms={((value as number[][]) ?? []).map((r) => [...r])}
              nIn={(comp.props.nIn as number) ?? 3}
              nOut={(comp.props.nOut as number) ?? 2}
              onChange={onChange}
            />
          </div>
        );
      }
      return null;
    }
  }
}

// ---------------- panel principal ----------------

export function PropertiesPanel() {
  const components = useCircuit((s) => s.components);
  const selection = useCircuit((s) => s.selection);
  const updateProps = useCircuit((s) => s.updateComponentProps);
  const renameComponent = useCircuit((s) => s.renameComponent);
  const deleteComponents = useCircuit((s) => s.deleteComponents);
  const duplicate = useCircuit((s) => s.duplicateComponent);
  const openTruthTable = useCircuit((s) => s.openTruthTable);

  const comp = useMemo(
    () => components.find((c) => c.id === selection[0]),
    [components, selection],
  );

  if (!comp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-[14px] text-tinta-2">Seleccioná una pieza de la hoja para ver y cambiar sus propiedades.</p>
      </div>
    );
  }

  const def = getDef(comp.type);
  if (!def) return null;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[15px] font-bold text-tinta">{def.label}</span>
          </div>
          <Input
            value={comp.label ?? ""}
            onChange={(e) => renameComponent(comp.id, e.target.value)}
            className="h-8 border-linea bg-hoja text-sm font-semibold text-tinta"
          />
        </div>

        <p className="text-[13px] leading-relaxed text-tinta-2">{def.description}</p>

        {def.equation && def.equation(comp.props) && (
          <p className="rounded-sm border border-sel bg-sel-suave p-2 font-mono text-[12px] leading-relaxed text-tinta">
            {def.equation(comp.props)}
          </p>
        )}

        {def.truthTable && def.truthTable(comp.props) && (
          <Button variant="outline" size="sm" className="w-full border-linea text-xs" onClick={() => openTruthTable(comp.id)}>
            Ver tabla de verdad
          </Button>
        )}

        <div className="space-y-3">
          {(def.propFields ?? []).map((field) => (
            <PropFieldEditor
              key={field.key + field.kind}
              field={field}
              value={comp.props[field.key]}
              comp={comp}
              onChange={(v) => updateProps(comp.id, { [field.key]: v })}
            />
          ))}
        </div>

        <div className="flex gap-2 border-t border-linea pt-3">
          <Button variant="outline" size="sm" className="flex-1 border-linea text-xs" onClick={() => duplicate(comp.id)}>
            Duplicar
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={() => deleteComponents([comp.id])}>
            Eliminar
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

/** panel derecho con pestañas: propiedades | karnaugh | waveform */
export function RightPanel({ kmapPanel, wavePanel }: { kmapPanel: React.ReactNode; wavePanel: React.ReactNode }) {
  const rightTab = useCircuit((s) => s.rightTab);
  const setRightTab = useCircuit((s) => s.setRightTab);
  return (
    <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as never)} className="flex h-full flex-col">
      <h2 className="sr-only">Análisis del circuito</h2>
      <TabsList className="flex h-10 w-full shrink-0 justify-start gap-0 rounded-none border-b border-linea-fuerte bg-transparent p-0">
        {([["props", "Propiedades"], ["kmap", "Karnaugh"], ["wave", "Ondas"]] as const).map(([v, n]) => (
          <TabsTrigger key={v} value={v} className="h-10 flex-1 rounded-none border-0 border-b-2 border-transparent bg-transparent text-[13px] text-tinta-2 data-[state=active]:border-tinta data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-tinta">
            {n}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="props" className="mt-0 min-h-0 flex-1">
        <PropertiesPanel />
      </TabsContent>
      <TabsContent value="kmap" className="mt-0 min-h-0 flex-1">
        {kmapPanel}
      </TabsContent>
      <TabsContent value="wave" className="mt-0 min-h-0 flex-1">
        {wavePanel}
      </TabsContent>
    </Tabs>
  );
}
