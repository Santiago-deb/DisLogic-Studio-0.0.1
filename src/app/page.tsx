// ============================================================
// DisLogic — Aplicación principal
// Santiago Santillán — Diseño Lógico UTN
// ============================================================
"use client";

import { useEffect, useRef } from "react";
import { TopBar } from "@/components/panels/top-bar";
import { BottomBar } from "@/components/panels/bottom-bar";
import { Palette } from "@/components/panels/palette";
import { RightPanel } from "@/components/panels/properties-panel";
import { KmapPanel } from "@/components/panels/kmap-panel";
import { WaveformPanel } from "@/components/panels/waveform-panel";
import { ProcessorPanel } from "@/components/panels/processor-panel";
import { CircuitCanvas, EmptyState } from "@/components/circuit/circuit-canvas";
import { TruthTableDialog, ExamplesDialog, HelpDialog, ShareDialog } from "@/components/panels/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCircuit } from "@/lib/circuit/store";
import { Cpu } from "lucide-react";

const AUTOSAVE_KEY = "dislogic:autosave";

export default function Home() {
  const components = useCircuit((s) => s.components);
  const wires = useCircuit((s) => s.wires);
  const projectName = useCircuit((s) => s.projectName);
  const processorOpen = useCircuit((s) => s.processorOpen);
  const setProcessorOpen = useCircuit((s) => s.setProcessorOpen);
  const pushLog = useCircuit((s) => s.pushLog);
  const booted = useRef(false);

  // ---------- arranque: autosave o link compartido ----------
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("circuit");
    if (sharedId) {
      fetch(`/api/circuits/${sharedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((json) => {
          const data = JSON.parse(json.data);
          useCircuit.getState().loadCircuit(data);
          pushLog("success", "Circuito compartido cargado.");
        })
        .catch(() => pushLog("error", "No se pudo cargar el circuito compartido."));
      return;
    }
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data.components) && data.components.length > 0) {
          useCircuit.getState().loadCircuit(data);
          pushLog("info", "Sesión anterior restaurada.");
        }
      } catch {
        /* ignora autosave corrupto */
      }
    }
  }, []);

  // ---------- autosave ----------
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ name: projectName, components, wires }));
      } catch {
        /* cuota llena */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [components, wires, projectName]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0A0F18] text-slate-200">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        {/* paleta izquierda */}
        <aside className="hidden w-56 shrink-0 overflow-hidden border-r border-slate-800 md:block" aria-label="Paleta de componentes">
          <Palette />
        </aside>

        {/* canvas central */}
        <main className="relative min-w-0 flex-1" aria-label="Canvas de circuito">
          <CircuitCanvas />
          {components.length === 0 && <EmptyState />}
        </main>

        {/* panel derecho */}
        <aside className="hidden w-72 shrink-0 overflow-hidden border-l border-slate-800 bg-[#0B111C] lg:block" aria-label="Panel de propiedades">
          <RightPanel kmapPanel={<KmapPanel />} wavePanel={<WaveformPanel />} />
        </aside>
      </div>

      <BottomBar />

      {/* diálogos */}
      <TruthTableDialog />
      <ExamplesDialog />
      <HelpDialog />
      <ShareDialog />

      <Dialog open={processorOpen} onOpenChange={setProcessorOpen}>
        <DialogContent className="h-[92vh] w-[min(1200px,calc(100vw-2rem))] max-w-none border-slate-700 bg-[#0A0F18] p-0 text-slate-200 sm:max-w-none">
          <DialogHeader className="border-b border-slate-800 px-5 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-rose-400" />
              Procesador de 8 bits — Módulo 5
            </DialogTitle>
            <DialogDescription className="text-xs">
              Datapath completo: PC → RAM → IR → Unidad de Control → Banco de Registros → ALU → Acumulador. Incluye assembler integrado y análisis temporal.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(92vh-88px)] overflow-hidden">
            <ProcessorPanel />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
