// ============================================================
// DisLogic — Diálogos: tabla de verdad, ejemplos, ayuda, compartir
// ============================================================
"use client";

import { useMemo } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { getDef } from "@/lib/circuit/catalog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

// ---------------- Tabla de verdad ----------------

export function TruthTableDialog() {
  const compId = useCircuit((s) => s.truthTableFor);
  const open = compId !== null;
  const close = () => useCircuit.getState().openTruthTable(null);
  const components = useCircuit((s) => s.components);

  const content = useMemo(() => {
    if (!compId) return null;
    const comp = components.find((c) => c.id === compId);
    if (!comp) return null;
    const def = getDef(comp.type);
    if (!def) return null;
    const tt = def.truthTable?.(comp.props) ?? null;
    return { def, tt, comp };
  }, [compId, components]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg border-slate-700 bg-[#0D1420] text-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-xs text-cyan-300">{content?.def?.short}</span>
            Tabla de verdad — {content?.def?.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">{content?.def?.description}</DialogDescription>
        </DialogHeader>
        {content?.tt ? (
          <ScrollArea className="max-h-[50vh]">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  {content.tt.headers.map((h, i) => (
                    <th key={i} className="border border-slate-800 bg-[#111826] px-3 py-1.5 text-cyan-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.tt.rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-[#131A26]">
                    {row.map((cell, ci) => {
                      const isOut = ci === row.length - 1;
                      const color = isOut ? (cell === "1" ? "text-emerald-400" : cell === "0" ? "text-red-400" : "text-amber-400") : "text-slate-300";
                      return (
                        <td key={ci} className={`border border-slate-800 px-3 py-1 text-center ${color}`}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {content.tt.note && <p className="mt-2 rounded bg-[#111826] p-2 text-[11px] text-slate-400">{content.tt.note}</p>}
          </ScrollArea>
        ) : (
          <p className="text-sm text-slate-500">Este componente no tiene tabla de verdad estática (es configurable o secuencial).</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Galería de ejemplos ----------------

interface ExampleEntry {
  id: string;
  name: string;
  module: string;
  description: string;
}

const EXAMPLE_META: ExampleEntry[] = [
  { id: "nand-not", name: "NOT con NAND", module: "1", description: "Inversor implementado con una sola compuerta NAND (entradas unidas)." },
  { id: "nand-and", name: "AND con NAND", module: "1", description: "AND = NAND + inversor NAND. Implementación universal." },
  { id: "mux21-gates", name: "MUX 2:1 con AND-OR", module: "1", description: "S = A·S' + B·S. El multiplexor elemental." },
  { id: "mux21-nand", name: "MUX 2:1 solo NAND", module: "1", description: "El clásico de final: MUX 2:1 implementado con 4 NAND." },
  { id: "fa", name: "Full Adder", module: "1", description: "Sumador completo con función mayoría para el carry." },
  { id: "adder4", name: "Sumador Ripple 4 bits", module: "1", description: "4 Full Adders encadenados con carry chain." },
  { id: "kmap-demo", name: "Karnaugh: F=Σm(0,2,4,6,8,9,10,11,15)", module: "2", description: "Función de 4 variables minimizada y sintetizada en ANDORI." },
  { id: "lut-fa", name: "Sumador en FPGA (LUTs)", module: "2", description: "Full Adder con 2 LUTs: una para Sum y otra para Cout." },
  { id: "latch-sr", name: "Latch SR con NOR", module: "3", description: "Latch básico realimentado. Probá el estado prohibido S=R=1." },
  { id: "ffd", name: "Flip-Flop D", module: "3", description: "FF-D edge-triggered con dato y clock." },
  { id: "counter4", name: "Contador 4 bits (FF-T)", module: "3", description: "Cadena de FF-T: cada etapa divide la frecuencia por 2 y suma un bit." },
  { id: "divider", name: "Divisor 100MHz → 12.5MHz", module: "3", description: "3 FF-T: 100/12.5 = 8 = 2³. El clásico del final." },
  { id: "nand-or", name: "OR con NOR (De Morgan)", module: "1", description: "A+B = NOR(NOR(A,B), NOR(A,B)). La otra compuerta universal." },
  { id: "dmux21", name: "DMUX 1:2 con compuertas", module: "1", description: "O0 = D·sel', O1 = D·sel. El dato va a la salida que indica sel." },
  { id: "pipo8", name: "Registro PIPO 8 bits (Ejercicio Fachero)", module: "4", description: "8 pines → COMBINER → REG_PIPO (LOAD+CLK) → SPLITTER → 8 LEDs. Ejercicio de final simplificado." },
  { id: "alu-demo", name: "ALU 8 bits con flags", module: "5", description: "0x0F y 0x03 como operandos, OP de 3 bits (000=ADD … 111=SHR). Sonda hex + flags Z/N." },
  { id: "jk-conversion", name: "FF-JK desde FF-D (conversión)", module: "5", description: "Conversión clásica de final: D = J·Q' + K'·Q con realimentación de Q y Q'." },
];

export function ExamplesDialog() {
  const open = useCircuit((s) => s.examplesOpen);
  const setOpen = useCircuit((s) => s.setExamplesOpen);
  const loadCircuit = useCircuit((s) => s.loadCircuit);
  const [loaded, setLoaded] = useState<string | null>(null);

  const load = async (id: string) => {
    const mod = await import("@/lib/circuit/examples");
    const example = mod.EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    loadCircuit(example.build());
    setLoaded(id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-slate-700 bg-[#0D1420] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-base">Galería de ejemplos — Finales de Diseño Lógico</DialogTitle>
          <DialogDescription className="text-xs">
            Circuitos precargados basados en los enunciados de final de la cátedra. Cargá uno y pasalo a modo simulación.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-2 pr-2 sm:grid-cols-2">
            {EXAMPLE_META.map((ex) => (
              <button
                key={ex.id}
                onClick={() => load(ex.id)}
                className="group rounded-lg border border-slate-800 bg-[#111826] p-3 text-left transition-all hover:border-cyan-700 hover:bg-[#16202F]"
                data-testid={`example-${ex.id}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300">{ex.name}</span>
                  <Badge variant="outline" className="border-slate-700 text-[9px] text-slate-500">M{ex.module}</Badge>
                </div>
                <p className="text-[10.5px] leading-snug text-slate-500">{ex.description}</p>
                {loaded === ex.id && <span className="mt-1 inline-block text-[9px] text-emerald-400">✓ cargado</span>}
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Ayuda ----------------

const SHORTCUTS: [string, string][] = [
  ["Arrastrar desde paleta", "agregar componente al canvas"],
  ["Clic en pin → arrastrar", "conectar un cable (verde = compatible)"],
  ["Clic en componente (sim)", "alternar pines de entrada / reloj"],
  ["Clic derecho", "menú: tabla de verdad, propiedades, eliminar"],
  ["Ctrl+Z / Ctrl+Shift+Z", "deshacer / rehacer"],
  ["Supr / Backspace", "eliminar selección"],
  ["Ctrl+D", "duplicar componente"],
  ["Rueda / Ctrl+rueda", "zoom"],
  ["Botón central + arrastre", "pan del canvas"],
  ["Play / Step / Reset", "control del reloj en simulación"],
  ["⏱ ns", "modo temporal: retardos reales por compuerta"],
];

export function HelpDialog() {
  const open = useCircuit((s) => s.helpOpen);
  const setOpen = useCircuit((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-slate-700 bg-[#0D1420] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-base">Atajos y tips</DialogTitle>
          <DialogDescription className="text-xs">DisLogic — simulador de circuitos digitales</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 rounded bg-[#111826] px-2.5 py-1.5">
              <span className="font-mono text-[10.5px] text-cyan-300">{k}</span>
              <span className="text-right text-[10.5px] text-slate-400">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-600">
          Colores de señal: <span className="text-emerald-400">verde = 1</span> · <span className="text-red-400">rojo = 0</span> · <span className="text-slate-400">gris punteado = flotante</span>.
          El grosor del cable indica bus de N bits con etiqueta /N.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Compartir ----------------

export function ShareDialog() {
  const open = useCircuit((s) => s.shareDialog);
  const setOpen = useCircuit((s) => s.setShareDialog);
  const url = useCircuit((s) => s.shareUrl);
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
      <DialogContent className="max-w-md border-slate-700 bg-[#0D1420] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-base">Circuito compartido</DialogTitle>
          <DialogDescription className="text-xs">
            Cualquier persona con este link verá tu circuito cargado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url ?? ""}
            className="h-9 flex-1 rounded-md border border-slate-700 bg-[#0D1420] px-2 font-mono text-[11px] text-cyan-300 outline-none"
          />
          <Button
            size="sm"
            className="bg-cyan-600 text-white hover:bg-cyan-500"
            onClick={() => {
              if (url) navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
