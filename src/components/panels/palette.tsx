// El catálogo de piezas: cada fila muestra el símbolo real. Se arrastra al lienzo o se agrega con clic o Enter.
"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/circuit/catalog";
import type { ComponentType } from "@/lib/circuit/types";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COMPUERTAS, SimboloCompuerta } from "@/components/circuit/simbolos";

const ORDEN: Record<string, ComponentType[]> = {
  gates: ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "TRI_STATE_BUFFER"],
  wiring: ["INPUT_PIN", "OUTPUT_PIN", "CLOCK", "CONSTANT", "POWER", "GROUND", "PROBE", "TUNNEL", "SPLITTER", "COMBINER"],
  plexers: ["MUX", "DMUX", "DECODER", "ENCODER"],
  arithmetic: ["HALF_ADDER", "FULL_ADDER", "ADDER_N", "SUBTRACTOR_N", "ADDER_SUBTRACTOR", "COMPARATOR", "ALU"],
  sequential: ["LATCH_SR", "LATCH_D", "FF_D", "FF_JK", "FF_T", "REG_PIPO", "REG_UNIVERSAL", "REGISTER_FILE", "COUNTER_SYNC_UP", "COUNTER_SYNC_DOWN", "COUNTER_ASYNC", "FREQ_DIVIDER"],
  synthesis: ["LUT", "ROM", "PLA"],
  processor: ["RAM"],
};

const NOMBRES: Partial<Record<ComponentType, string>> = { INPUT_PIN: "Entrada", OUTPUT_PIN: "Salida", POWER: "Alimentación", GROUND: "Tierra", TUNNEL: "Túnel" };

function Miniatura({ tipo, codigo }: { tipo: ComponentType; codigo: string }) {
  if (COMPUERTAS.includes(tipo)) {
    const entradas = tipo === "NOT" || tipo === "BUFFER" || tipo === "TRI_STATE_BUFFER" ? 1 : 2;
    return (
      <span className="relative block h-[25px] w-[46px] shrink-0">
        <span className="absolute left-0 top-0 origin-top-left scale-50">
          <SimboloCompuerta tipo={tipo} nEntradas={entradas} alto={50} ancho={92} />
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-[25px] w-[46px] shrink-0 items-center justify-center border border-linea-fuerte bg-hoja font-mono text-[11px] font-bold text-tinta">
      {codigo.length > 6 ? codigo.slice(0, 5) : codigo}
    </span>
  );
}

export function Palette({ onAdd }: { onAdd?: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [plegado, setPlegado] = useState<Record<string, boolean>>({});

  const filtrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const r: Record<string, ComponentType[]> = {};
    for (const [cat, tipos] of Object.entries(ORDEN)) {
      const lista = tipos.filter((t) => {
        const def = CATALOG[t];
        if (!def) return false;
        return !q || def.label.toLowerCase().includes(q) || def.short.toLowerCase().includes(q) || def.description.toLowerCase().includes(q);
      });
      if (lista.length > 0) r[cat] = lista;
    }
    return r;
  }, [busqueda]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-papel">
      <div className="shrink-0 border-b border-linea p-2.5">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar pieza"
          aria-label="Buscar pieza"
          className="h-8 text-[13px]"
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-3">
          {Object.entries(filtrado).map(([cat, tipos]) => {
            const categoria = CATEGORIES.find((c) => c.id === cat);
            const cerrado = plegado[cat] && !busqueda;
            return (
              <section key={cat}>
                <button
                  className="flex w-full items-center gap-1 px-2.5 pb-1 pt-3 text-left text-[13px] font-bold text-tinta"
                  aria-expanded={!cerrado}
                  onClick={() => setPlegado((c) => ({ ...c, [cat]: !c[cat] }))}
                >
                  {cerrado ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {categoria?.label}
                </button>
                {!cerrado && (
                  <ul>
                    {tipos.map((t) => {
                      const def = CATALOG[t];
                      return (
                        <li key={t}>
                          <button
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/dislogic", t);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent("dislogic:agregar", { detail: t }));
                              onAdd?.();
                            }}
                            title={def.description}
                            className="flex w-full cursor-grab items-center gap-2.5 px-2.5 py-1 text-left hover:bg-hoja-2 active:cursor-grabbing"
                            data-testid={`palette-${t}`}
                          >
                            <Miniatura tipo={t} codigo={def.short} />
                            <span className="min-w-0 truncate text-[13px] text-tinta">{NOMBRES[t] ?? def.label.replace(/\s*\(.*\)\s*/, "")}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          {Object.keys(filtrado).length === 0 && <p className="p-4 text-[13px] text-tinta-2">Ninguna pieza coincide con «{busqueda}». Probá con otra palabra.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}
