// ============================================================
// DisLogic — Paleta de componentes (sidebar izquierda)
// Organizada por categorías con búsqueda y drag & drop
// ============================================================
"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/circuit/catalog";
import type { ComponentType } from "@/lib/circuit/types";
import { useCircuit } from "@/lib/circuit/store";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, GripVertical } from "lucide-react";

const CATEGORY_ICONS: Record<string, string> = {
  gates: "⚡",
  wiring: "🔌",
  plexers: "🎛",
  arithmetic: "➕",
  sequential: "🔄",
  synthesis: "🧩",
  processor: "🖥",
};

const PALETTE_ORDER: Record<string, ComponentType[]> = {
  gates: ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "TRI_STATE_BUFFER"],
  wiring: ["INPUT_PIN", "OUTPUT_PIN", "CLOCK", "CONSTANT", "POWER", "GROUND", "PROBE", "TUNNEL", "SPLITTER", "COMBINER"],
  plexers: ["MUX", "DMUX", "DECODER", "ENCODER"],
  arithmetic: ["HALF_ADDER", "FULL_ADDER", "ADDER_N", "SUBTRACTOR_N", "ADDER_SUBTRACTOR", "COMPARATOR", "ALU"],
  sequential: ["LATCH_SR", "LATCH_D", "FF_D", "FF_JK", "FF_T", "REG_PIPO", "REG_UNIVERSAL", "REGISTER_FILE", "COUNTER_SYNC_UP", "COUNTER_SYNC_DOWN", "COUNTER_ASYNC", "FREQ_DIVIDER"],
  synthesis: ["LUT", "ROM", "PLA"],
  processor: ["RAM"],
};

export function Palette({ onAdd }: { onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const addComponent = useCircuit((s) => s.addComponent);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: Record<string, ComponentType[]> = {};
    for (const [cat, types] of Object.entries(PALETTE_ORDER)) {
      const list = types.filter((t) => {
        const def = CATALOG[t];
        if (!def) return false;
        if (!q) return true;
        return def.label.toLowerCase().includes(q) || def.short.toLowerCase().includes(q) || def.description.toLowerCase().includes(q);
      });
      if (list.length > 0) result[cat] = list;
    }
    return result;
  }, [query]);

  const onDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData("application/dislogic", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0D1420]">
      <div className="shrink-0 border-b border-slate-800 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar componente…"
            className="h-8 border-slate-700 bg-[#131A26] pl-8 text-xs text-slate-200 placeholder:text-slate-600 focus-visible:ring-cyan-500"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {Object.entries(filtered).map(([cat, types]) => {
            const catDef = CATEGORIES.find((c) => c.id === cat);
            const isCollapsed = collapsed[cat];
            return (
              <div key={cat} className="mb-1">
                <button
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider hover:bg-[#131A26]"
                  style={{ color: catDef?.color }}
                  onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[cat] ?? "•"}</span>
                    {catDef?.label}
                  </span>
                  <span className="text-slate-600">{isCollapsed ? "▸" : "▾"}</span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                    {types.map((t) => {
                      const def = CATALOG[t];
                      return (
                        <div
                          key={t}
                          draggable
                          onDragStart={(e) => onDragStart(e, t)}
                          onClick={() => {
                            addComponent(t, 260 + Math.random() * 160, 160 + Math.random() * 160);
                            onAdd?.();
                          }}
                          title={def.description}
                          className="group flex cursor-grab flex-col items-center gap-0.5 rounded-md border border-slate-800 bg-[#111826] px-1 py-2 transition-all hover:border-cyan-600 hover:bg-[#16202F] active:cursor-grabbing"
                          data-testid={`palette-${t}`}
                        >
                          <span className="font-mono text-[11px] font-bold text-slate-200 group-hover:text-cyan-300">
                            {def.short}
                          </span>
                          <span className="line-clamp-1 text-center text-[8.5px] leading-tight text-slate-500">
                            {def.label.replace(/\s*\(.*\)\s*/, "")}
                          </span>
                          <GripVertical className="h-2.5 w-2.5 text-slate-700 group-hover:text-slate-500" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(filtered).length === 0 && (
            <p className="p-4 text-center text-xs text-slate-600">Sin resultados para «{query}»</p>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-slate-800 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
        <span className="text-slate-500">💡</span> Arrastrá al canvas o hacé clic para agregar
      </div>
    </div>
  );
}
