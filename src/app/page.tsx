// ============================================================
// DisLogic — Aplicación principal
// Santiago Santillán — Diseño Lógico UTN
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCircuit } from "@/lib/circuit/store";
import { Cpu, Boxes, PanelRightOpen } from "lucide-react";

const AUTOSAVE_KEY = "dislogic:autosave";

export default function Home() {
  const components = useCircuit((s) => s.components);
  const wires = useCircuit((s) => s.wires);
  const projectName = useCircuit((s) => s.projectName);
  const processorOpen = useCircuit((s) => s.processorOpen);
  const setProcessorOpen = useCircuit((s) => s.setProcessorOpen);
  const pushLog = useCircuit((s) => s.pushLog);
  const booted = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

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
          setTimeout(() => window.dispatchEvent(new CustomEvent("dislogic:fit")), 60);
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

          {/* ─── Mobile: acceso a Paleta y Panel derecho (desktop los tiene como asides) ─── */}
          <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
            <SheetTrigger asChild>
              <Button
                className="absolute bottom-14 right-3 z-20 h-11 gap-2 rounded-full border border-cyan-700/60 bg-[#0B2233] px-4 text-xs font-semibold text-cyan-200 shadow-[0_4px_16px_rgba(0,170,255,0.25)] hover:bg-[#10293f] active:scale-95 md:hidden"
                aria-label="Abrir paleta de componentes"
                data-testid="fab-palette"
              >
                <Boxes className="h-4 w-4" /> Componentes
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(18rem,86vw)] gap-0 border-slate-800 bg-[#0D1420] p-0">
              <SheetHeader className="border-b border-slate-800 px-3 py-2.5">
                <SheetTitle className="text-xs font-semibold uppercase tracking-widest text-slate-300">Paleta de componentes</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <Palette onAdd={() => setPaletteOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetTrigger asChild>
              <Button
                className="absolute bottom-3 right-3 z-20 h-11 gap-2 rounded-full border border-slate-700 bg-[#131A26] px-4 text-xs font-semibold text-slate-200 shadow-lg hover:bg-[#1B2536] active:scale-95 md:hidden"
                aria-label="Abrir panel de propiedades"
                data-testid="fab-panel"
              >
                <PanelRightOpen className="h-4 w-4 text-cyan-300" /> Panel
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,90vw)] gap-0 border-slate-800 bg-[#0B111C] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Panel de propiedades</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <RightPanel kmapPanel={<KmapPanel />} wavePanel={<WaveformPanel />} />
              </div>
            </SheetContent>
          </Sheet>
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
