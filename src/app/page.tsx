"use client";

import { useEffect, useState } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCircuit } from "@/lib/circuit/store";
import { fragmentoACircuito, validarCircuito } from "@/lib/circuit/compartir";

const AUTOSAVE_KEY = "dislogic:autosave";
const ajustar = () => setTimeout(() => window.dispatchEvent(new CustomEvent("dislogic:fit")), 60);

export default function Home() {
  const components = useCircuit((s) => s.components);
  const wires = useCircuit((s) => s.wires);
  const projectName = useCircuit((s) => s.projectName);
  const processorOpen = useCircuit((s) => s.processorOpen);
  const setProcessorOpen = useCircuit((s) => s.setProcessorOpen);
  const pushLog = useCircuit((s) => s.pushLog);
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(AUTOSAVE_KEY);
      const circuito = guardado ? validarCircuito(JSON.parse(guardado)) : null;
      if (circuito && circuito.components.length > 0) {
        useCircuit.getState().loadCircuit(circuito);
        pushLog("info", "Se restauró la sesión anterior.");
      }
    } catch {
      /* lo guardado está dañado: se empieza de cero */
    }

    // Lo que había queda en el historial: Ctrl+Z lo recupera. El link se saca de la dirección para que recargar no pise lo editado.
    const abrirLink = () => {
      if (!location.hash.startsWith("#c=")) return;
      fragmentoACircuito(location.hash)
        .then((c) => {
          if (!c) return;
          useCircuit.getState().loadCircuit(c);
          ajustar();
          pushLog("info", "Se abrió el circuito del link. Ctrl+Z vuelve al que tenías.");
        })
        .catch(() => pushLog("error", "No se abrió el link: está incompleto o dañado."))
        .finally(() => history.replaceState(null, "", location.pathname + location.search));
    };
    abrirLink();
    window.addEventListener("hashchange", abrirLink);
    return () => window.removeEventListener("hashchange", abrirLink);
  }, [pushLog]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ name: projectName, components, wires }));
      } catch {
        /* sin espacio: no se guarda */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [components, wires, projectName]);

  const panel = <RightPanel kmapPanel={<KmapPanel />} wavePanel={<WaveformPanel />} />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-papel text-tinta">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-hidden border-r border-linea-fuerte md:block" aria-label="Catálogo de piezas">
          <Palette />
        </aside>

        <main className="relative min-w-0 flex-1" aria-label="Hoja del circuito">
          <CircuitCanvas />
          {components.length === 0 && <EmptyState />}
        </main>

        <aside className="hidden w-80 shrink-0 overflow-hidden border-l border-linea-fuerte bg-papel lg:block" aria-label="Panel de análisis">
          {panel}
        </aside>
      </div>

      {/* En pantallas angostas, el catálogo y el panel se abren desde esta fila. */}
      <div className="grid shrink-0 grid-cols-2 border-t border-linea-fuerte lg:hidden">
        <button onClick={() => setCatalogoAbierto(true)} className="h-11 border-r border-linea-fuerte text-[14px] font-bold text-tinta md:hidden" data-testid="fab-palette">
          Piezas
        </button>
        <button onClick={() => setPanelAbierto(true)} className="col-span-1 h-11 text-[14px] font-bold text-tinta md:col-span-2" data-testid="fab-panel">
          Panel
        </button>
      </div>

      <BottomBar />

      <Sheet open={catalogoAbierto} onOpenChange={setCatalogoAbierto}>
        <SheetContent side="left" className="w-[min(18rem,86vw)] gap-0 p-0">
          <SheetHeader className="border-b border-linea px-3 py-2.5">
            <SheetTitle className="text-[15px]">Piezas</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <Palette onAdd={() => setCatalogoAbierto(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={panelAbierto} onOpenChange={setPanelAbierto}>
        <SheetContent side="right" className="w-[min(22rem,92vw)] gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Panel de análisis</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">{panel}</div>
        </SheetContent>
      </Sheet>

      <TruthTableDialog />
      <ExamplesDialog />
      <HelpDialog />
      <ShareDialog />

      <Dialog open={processorOpen} onOpenChange={setProcessorOpen}>
        <DialogContent className="flex h-[92dvh] w-[min(1200px,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b border-linea px-5 py-3">
            <DialogTitle className="text-[17px]">Procesador de 8 bits</DialogTitle>
            <DialogDescription className="text-[13px]">Cargá un programa y seguí cada ciclo por el datapath.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ProcessorPanel />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
