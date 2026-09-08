// ============================================================
// DisLogic — Barra inferior: consola de mensajes, estado y footer
// ============================================================
"use client";

import { useEffect, useRef } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { ScrollArea } from "@/components/ui/scroll-area";

const LEVEL_STYLE: Record<string, string> = {
  info: "text-slate-400",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

const LEVEL_ICON: Record<string, string> = {
  info: "·",
  success: "✓",
  warn: "⚠",
  error: "✕",
};

export function BottomBar() {
  const log = useCircuit((s) => s.log);
  const clearLog = useCircuit((s) => s.clearLog);
  const mode = useCircuit((s) => s.mode);
  const running = useCircuit((s) => s.running);
  const temporal = useCircuit((s) => s.temporal);
  const components = useCircuit((s) => s.components);
  const wires = useCircuit((s) => s.wires);
  const oscillating = useCircuit((s) => s.oscillating);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [log]);

  return (
    <footer
      className="mt-auto flex h-[104px] shrink-0 items-stretch border-t border-slate-800 bg-[#0A0F18] pb-[env(safe-area-inset-bottom)]"
      data-testid="bottom-bar"
    >
      {/* estado */}
      <div className="flex w-56 shrink-0 flex-col justify-center gap-1 border-r border-slate-800 px-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${mode === "sim" ? (running ? "animate-pulse bg-emerald-400" : "bg-emerald-700") : "bg-slate-600"}`}
          />
          <span className="text-[11px] font-semibold text-slate-300">
            {mode === "sim" ? (running ? "Simulando" : "Simulación en pausa") : "Modo edición"}
          </span>
          {temporal && <span className="rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-400">NS</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-2 font-mono text-[10px] text-slate-500">
          <span>Comp: <span className="text-slate-300">{components.length}</span></span>
          <span>Cables: <span className="text-slate-300">{wires.length}</span></span>
          <span>Modo: <span className="text-slate-300">{temporal ? "temporal" : "ideal"}</span></span>
          <span>
            Estado:{" "}
            <span className={oscillating ? "text-red-400" : "text-emerald-400"}>
              {oscillating ? "inestable" : "estable"}
            </span>
          </span>
        </div>
        <p className="truncate text-[9px] text-slate-600">
          Diseñado por <span className="text-slate-500">Santiago Santillán</span> — Diseño Lógico UTN
        </p>
      </div>

      {/* consola */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-800/60 px-3 py-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">Consola de simulación</span>
          <button onClick={clearLog} className="text-[9px] text-slate-600 hover:text-slate-300">
            limpiar
          </button>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-1" data-testid="console">
          {log.length === 0 ? (
            <p className="text-[10px] text-slate-700">
              Bienvenido a DisLogic — cambiá a modo simulación y hacé clic en los pines de entrada.
            </p>
          ) : (
            log.map((m) => (
              <p key={m.id} className={`font-mono text-[10px] leading-[1.5] ${LEVEL_STYLE[m.level]}`}>
                <span className="text-slate-700">{m.time}</span> {LEVEL_ICON[m.level]} {m.text}
              </p>
            ))
          )}
        </div>
      </div>
    </footer>
  );
}
