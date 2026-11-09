// ============================================================
// DisLogic — Diálogos: tabla de verdad, ejemplos, ayuda, compartir
// ============================================================
"use client";

import { useMemo } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { getDef } from "@/lib/circuit/catalog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <DialogContent className="max-w-lg border-linea bg-hoja text-tinta">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Tabla de verdad de {content?.def?.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-tinta-2">{content?.def?.description}</DialogDescription>
        </DialogHeader>
        {content?.tt ? (
          <ScrollArea className="max-h-[50vh]">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  {content.tt.headers.map((h, i) => (
                    <th key={i} className="border border-linea-fuerte bg-hoja-2 px-3 py-1.5 text-tinta">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.tt.rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-hoja-2">
                    {row.map((cell, ci) => {
                      const isOut = ci === row.length - 1;
                      const color = isOut && cell === "1" ? "font-bold text-alto" : "text-tinta";
                      return (
                        <td key={ci} className={`border border-linea px-3 py-1 text-center ${color}`}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {content.tt.note && <p className="mt-2 text-[13px] text-tinta-2">{content.tt.note}</p>}
          </ScrollArea>
        ) : (
          <p className="text-sm text-tinta-2">Esta pieza no tiene una tabla de verdad fija: depende de su configuración o de su estado.</p>
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
  { id: "pipo8", name: "Registro PIPO 8 bits", module: "4", description: "8 pines → COMBINER → REG_PIPO (LOAD+CLK) → SPLITTER → 8 LEDs. Captura del bus en el flanco del clock." },
  { id: "alu-demo", name: "ALU 8 bits con flags", module: "5", description: "0x0F y 0x03 como operandos, OP de 3 bits (000=ADD … 111=SHR). Sonda hex + flags Z/N." },
  { id: "jk-conversion", name: "FF-JK desde FF-D (conversión)", module: "5", description: "Conversión clásica de final: D = J·Q' + K'·Q con realimentación de Q y Q'." },
];

export function ExamplesDialog() {
  const open = useCircuit((s) => s.examplesOpen);
  const setOpen = useCircuit((s) => s.setExamplesOpen);
  const loadCircuit = useCircuit((s) => s.loadCircuit);

  const load = async (id: string) => {
    const mod = await import("@/lib/circuit/examples");
    const example = mod.EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    loadCircuit(example.build());
    setOpen(false);
    // centra el circuito cargado en el viewport visible
    setTimeout(() => window.dispatchEvent(new CustomEvent("dislogic:fit")), 60);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-linea bg-hoja text-tinta">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Ejemplos</DialogTitle>
          <DialogDescription className="text-[13px]">Circuitos de los finales de Diseño Lógico. Cargá uno y pasá a Simular.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[62dvh]">
          <div className="pr-3">
            {["1", "2", "3", "4", "5"].map((m) => (
              <section key={m} className="mb-3">
                <h3 className="border-b border-linea-fuerte pb-1 text-[13px] font-bold text-tinta">Módulo {m}</h3>
                <ul>
                  {EXAMPLE_META.filter((e) => e.module === m).map((ex) => (
                    <li key={ex.id} className="border-b border-linea">
                      <button onClick={() => load(ex.id)} className="block w-full px-1.5 py-2 text-left hover:bg-hoja-2" data-testid={`example-${ex.id}`}>
                        <span className="block text-[14px] font-bold text-tinta">{ex.name}</span>
                        <span className="block text-[13px] leading-snug text-tinta-2">{ex.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Ayuda ----------------

const SHORTCUTS: [string, string][] = [
  ["Arrastrar desde Piezas", "agregar una pieza a la hoja"],
  ["Arrastrar desde un pin", "conectar un cable"],
  ["Clic en un interruptor", "cambiar entre 0 y 1 al simular"],
  ["Clic en un cable + Supr", "eliminar el cable"],
  ["Clic derecho", "tabla de verdad, propiedades, eliminar"],
  ["Ctrl+Z / Ctrl+Shift+Z", "deshacer / rehacer"],
  ["Supr", "eliminar lo seleccionado"],
  ["Ctrl+D", "duplicar la pieza"],
  ["Rueda", "desplazar la hoja"],
  ["Ctrl + rueda", "acercar o alejar"],
  ["Botón central y arrastrar", "mover la hoja"],
  ["Retardos", "simular con el retardo de cada compuerta"],
];

export function HelpDialog() {
  const open = useCircuit((s) => s.helpOpen);
  const setOpen = useCircuit((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto border-linea bg-hoja text-tinta">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Cómo se usa</DialogTitle>
          <DialogDescription className="text-[13px]">Atajos y lectura de las señales.</DialogDescription>
        </DialogHeader>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-linea py-1.5">
              <dt className="text-[13px] font-bold text-tinta">{k}</dt>
              <dd className="text-right text-[13px] text-tinta-2">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] leading-relaxed text-tinta-2">
          Un 1 es un trazo grueso y un 0, fino. Punteado significa que nadie conduce ese cable. Un bus lleva una marca con su cantidad de bits.
        </p>
        <p className="text-[13px] text-tinta-2">Santiago Santillan, Diseño Lógico, UNICEN.</p>
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
      <DialogContent className="max-w-md border-linea bg-hoja text-tinta">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Link del circuito</DialogTitle>
          <DialogDescription className="text-xs">
            Quien abra este link ve una copia de tu circuito. El circuito viaja dentro del link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url ?? ""}
            aria-label="Link del circuito"
            className="h-9 min-w-0 flex-1 border border-linea-fuerte bg-papel px-2 font-mono text-[12px] text-tinta"
          />
          <Button
            size="sm"
            onClick={() => {
              if (url) navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
