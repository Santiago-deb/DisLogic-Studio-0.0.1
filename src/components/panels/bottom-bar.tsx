// Línea de estado: qué está pasando, en una fila. La consola se despliega cuando hace falta.
"use client";

import { useEffect, useRef, useState } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { ChevronDown, ChevronUp } from "lucide-react";

const COLOR: Record<string, string> = { info: "text-tinta-2", success: "text-tinta", warn: "text-aviso", error: "text-fallo" };

export function BottomBar() {
  const log = useCircuit((s) => s.log);
  const clearLog = useCircuit((s) => s.clearLog);
  const mode = useCircuit((s) => s.mode);
  const running = useCircuit((s) => s.running);
  const clockHz = useCircuit((s) => s.clockHz);
  const nPiezas = useCircuit((s) => s.components.length);
  const nCables = useCircuit((s) => s.wires.length);
  const oscillating = useCircuit((s) => s.oscillating);
  const [abierta, setAbierta] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [log, abierta]);

  const ultimo = log[log.length - 1];
  const estado = mode === "edit" ? "Edición" : running ? `Simulando a ${clockHz} Hz` : "Simulación en pausa";

  return (
    <footer className="shrink-0 border-t border-linea-fuerte bg-papel pb-[env(safe-area-inset-bottom)]" data-testid="bottom-bar">
      {abierta && (
        <div className="border-b border-linea">
          <div ref={scrollRef} className="h-36 overflow-y-auto px-3 py-2" data-testid="console">
            {log.length === 0 ? (
              <p className="text-[13px] text-tinta-2">Todavía no hay mensajes.</p>
            ) : (
              log.map((m) => (
                <p key={m.id} className={`font-mono text-[12px] leading-5 ${COLOR[m.level]}`}>
                  <span className="text-tinta-2">{m.time}</span> {m.text}
                </p>
              ))
            )}
          </div>
        </div>
      )}
      <div className="flex h-8 items-center gap-4 px-3 text-[12px] text-tinta-2">
        <span className="shrink-0 font-bold text-tinta">{estado}</span>
        <span className="hidden shrink-0 sm:inline">
          {nPiezas} {nPiezas === 1 ? "pieza" : "piezas"}, {nCables} {nCables === 1 ? "cable" : "cables"}
        </span>
        {mode === "sim" && oscillating && <span className="shrink-0 font-bold text-fallo">El circuito oscila</span>}
        <span className={`min-w-0 flex-1 truncate ${ultimo ? COLOR[ultimo.level] : ""}`} role="status">
          {ultimo?.text ?? ""}
        </span>
        {abierta && (
          <button onClick={clearLog} className="shrink-0 underline underline-offset-2 hover:text-tinta">
            Limpiar
          </button>
        )}
        <button
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
          className="flex shrink-0 items-center gap-1 hover:text-tinta"
          data-testid="btn-consola"
        >
          Consola {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
    </footer>
  );
}
