// ============================================================
// DisLogic — Barra superior: identidad, modos, simulación y archivo
// Desktop: fila única como siempre. Mobile: 2 filas compactas
// con menú desbordante (⋯) para el resto de las acciones.
// ============================================================
"use client";

import { useRef } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play, Pause, SkipForward, RotateCcw, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  FilePlus2, Download, Upload, Share2, Boxes, Cpu, Keyboard, Zap, Pencil, MoreVertical,
} from "lucide-react";
import type { CircuitData } from "@/lib/circuit/types";

function ChipLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-md border-2 border-cyan-400 bg-[#0B2233] shadow-[0_0_12px_#00AAFF44]">
        <span className="font-mono text-[9px] font-black tracking-tighter text-cyan-300">DL</span>
        <span className="absolute -left-1 top-1.5 h-1 w-1.5 bg-cyan-400" />
        <span className="absolute -left-1 top-4 h-1 w-1.5 bg-cyan-400" />
        <span className="absolute -right-1 top-1.5 h-1 w-1.5 bg-cyan-400" />
        <span className="absolute -right-1 top-4 h-1 w-1.5 bg-cyan-400" />
      </div>
      <div className="leading-none">
        <span className="block text-sm font-black tracking-tight text-slate-100">
          Dis<span className="text-cyan-400">Logic</span>
        </span>
        <span className="hidden sm:block text-[8.5px] uppercase tracking-widest text-slate-500">Simulador Digital</span>
      </div>
    </div>
  );
}

function TBButton({
  children,
  onClick,
  title,
  disabled,
  variant = "ghost",
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  variant?: "ghost" | "outline" | "default" | "secondary" | "destructive";
  testId?: string;
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size="icon" className="h-8 w-8 shrink-0 text-slate-300 hover:bg-[#1B2536] hover:text-cyan-300" onClick={onClick} disabled={disabled} data-testid={testId}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="border-slate-700 bg-[#131A26] text-xs text-slate-200">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TopBar() {
  const s = useCircuit();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveJson = () => {
    const data: CircuitData = s.getCircuit();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, "_")}.dislogic.json`;
    a.click();
    URL.revokeObjectURL(url);
    s.pushLog("success", "Proyecto exportado como JSON.");
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as CircuitData;
        if (!Array.isArray(data.components)) throw new Error("formato inválido");
        s.loadCircuit(data);
      } catch {
        s.pushLog("error", "El archivo no es un proyecto DisLogic válido.");
      }
    };
    reader.readAsText(file);
  };

  const share = async () => {
    try {
      const data = s.getCircuit();
      const res = await fetch("/api/circuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, data: JSON.stringify(data) }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const url = `${window.location.origin}/?circuit=${json.id}`;
      s.setShareDialog(true, url);
    } catch {
      s.pushLog("error", "No se pudo compartir el circuito (servidor no disponible).");
    }
  };

  // ---------- piezas compartidas (desktop + mobile) ----------

  const modeToggle = (
    <ToggleGroup
      type="single"
      value={s.mode}
      onValueChange={(v) => v && s.setMode(v as "edit" | "sim")}
      className="shrink-0 rounded-md bg-[#111826] p-0.5"
    >
      <ToggleGroupItem value="edit" className="h-7 gap-1 rounded px-2 text-[11px] font-medium data-[state=on]:bg-[#1B2536] data-[state=on]:text-cyan-300" data-testid="mode-edit">
        <Pencil className="h-3 w-3" />
        <span className="md:hidden">Edit</span>
        <span className="hidden md:inline">Edición</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="sim" className="h-7 gap-1 rounded px-2 text-[11px] font-medium data-[state=on]:bg-emerald-500/20 data-[state=on]:text-emerald-300" data-testid="mode-sim">
        <Zap className="h-3 w-3" />
        <span className="md:hidden">Sim</span>
        <span className="hidden md:inline">Simulación</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );

  const simControls = (
    <div className={`flex shrink-0 items-center gap-0.5 rounded-md bg-[#111826] p-0.5 transition-opacity ${s.mode !== "sim" ? "pointer-events-none opacity-35" : ""}`}>
      <TBButton title={s.running ? "Pausar" : "Reproducir"} onClick={() => s.setRunning(!s.running)} testId="btn-play">
        {s.running ? <Pause className="h-4 w-4 text-amber-400" /> : <Play className="h-4 w-4 text-emerald-400" />}
      </TBButton>
      <TBButton title="Paso a paso" onClick={s.stepSim} testId="btn-step">
        <SkipForward className="h-4 w-4" />
      </TBButton>
      <TBButton title="Reiniciar simulación" onClick={s.resetSim} testId="btn-reset">
        <RotateCcw className="h-4 w-4" />
      </TBButton>
      <div className="mx-1 flex shrink-0 items-center gap-1 rounded bg-[#0D1420] px-1.5 py-1 md:px-2">
        <span className="hidden text-[9px] uppercase tracking-wider text-slate-500 md:inline">CLK</span>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={s.clockHz}
          onChange={(e) => s.setClockHz(parseFloat(e.target.value))}
          className="h-1 w-8 accent-cyan-400 sm:w-14 md:w-16"
          aria-label="Frecuencia del clock"
        />
        <span className="w-8 font-mono text-[10px] text-cyan-300 md:w-10">{s.clockHz}Hz</span>
      </div>
      <button
        onClick={() => s.setTemporal(!s.temporal)}
        className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-semibold transition-colors md:px-2 ${
          s.temporal ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-700" : "text-slate-500 hover:text-slate-300"
        }`}
        title="Activar retardos reales por compuerta (ns)"
        data-testid="btn-temporal"
      >
        ⏱ ns
      </button>
    </div>
  );

  const oscillationBadge = s.oscillating ? (
    <span className="animate-pulse shrink-0 rounded-md bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-400 ring-1 ring-red-700">
      ⚠ OSCILACIÓN
    </span>
  ) : null;

  // ---------- menú desbordante (mobile) ----------
  const overflowMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-slate-300 hover:bg-[#1B2536] hover:text-cyan-300"
          aria-label="Menú de acciones"
          data-testid="btn-menu"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56 border-slate-700 bg-[#131A26] text-slate-200">
        <DropdownMenuItem onClick={s.undo} disabled={s.private_undo.length === 0} className="gap-2 text-xs">
          <Undo2 className="h-4 w-4" /> Deshacer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={s.redo} disabled={s.private_redo.length === 0} className="gap-2 text-xs">
          <Redo2 className="h-4 w-4" /> Rehacer
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("dislogic:zoomin"))} className="gap-2 text-xs">
          <ZoomIn className="h-4 w-4" /> Zoom +
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("dislogic:zoomout"))} className="gap-2 text-xs">
          <ZoomOut className="h-4 w-4" /> Zoom −
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("dislogic:fit"))} className="gap-2 text-xs">
          <Maximize className="h-4 w-4" /> Ajustar a pantalla
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem onClick={() => s.setExamplesOpen(true)} className="gap-2 text-xs text-cyan-300 focus:text-cyan-200" data-testid="menu-examples">
          <Boxes className="h-4 w-4" /> Ejemplos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => s.setProcessorOpen(true)} className="gap-2 text-xs text-rose-300 focus:text-rose-200" data-testid="menu-processor">
          <Cpu className="h-4 w-4" /> Procesador
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem onClick={s.newProject} className="gap-2 text-xs">
          <FilePlus2 className="h-4 w-4" /> Nuevo proyecto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={saveJson} className="gap-2 text-xs" data-testid="menu-export">
          <Download className="h-4 w-4" /> Exportar JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 text-xs">
          <Upload className="h-4 w-4" /> Importar JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={share} className="gap-2 text-xs" data-testid="menu-share">
          <Share2 className="h-4 w-4" /> Compartir link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => s.setHelpOpen(true)} className="gap-2 text-xs">
          <Keyboard className="h-4 w-4" /> Ayuda y atajos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="shrink-0 border-b border-slate-800 bg-[#0D1420]" data-testid="top-bar">
      {/* ══════════ DESKTOP — fila única (sin cambios) ══════════ */}
      <div className="hidden h-12 items-center gap-2 px-3 md:flex">
        <ChipLogo />

        <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

        <input
          value={s.projectName}
          onChange={(e) => useCircuit.setState({ projectName: e.target.value })}
          className="w-40 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-200 outline-none transition-colors hover:border-slate-700 focus:border-cyan-700 focus:bg-[#0D1420]"
          aria-label="Nombre del proyecto"
        />

        <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

        {modeToggle}
        {simControls}
        {oscillationBadge}

        <div className="flex-1" />

        {/* undo/redo/zoom */}
        <TBButton title="Deshacer (Ctrl+Z)" onClick={s.undo} disabled={s.private_undo.length === 0}>
          <Undo2 className="h-4 w-4" />
        </TBButton>
        <TBButton title="Rehacer (Ctrl+Shift+Z)" onClick={s.redo} disabled={s.private_redo.length === 0}>
          <Redo2 className="h-4 w-4" />
        </TBButton>
        <TBButton title="Zoom +" onClick={() => window.dispatchEvent(new CustomEvent("dislogic:zoomin"))}>
          <ZoomIn className="h-4 w-4" />
        </TBButton>
        <TBButton title="Zoom −" onClick={() => window.dispatchEvent(new CustomEvent("dislogic:zoomout"))}>
          <ZoomOut className="h-4 w-4" />
        </TBButton>
        <TBButton title="Ajustar a pantalla" onClick={() => window.dispatchEvent(new CustomEvent("dislogic:fit"))}>
          <Maximize className="h-4 w-4" />
        </TBButton>

        <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

        {/* herramientas */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-cyan-800/70 bg-cyan-950/40 text-xs text-cyan-300 hover:bg-cyan-900/40" onClick={() => s.setExamplesOpen(true)} data-testid="btn-examples">
          <Boxes className="h-3.5 w-3.5" /> Ejemplos
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-rose-800/70 bg-rose-950/30 text-xs text-rose-300 hover:bg-rose-900/40" onClick={() => s.setProcessorOpen(true)} data-testid="btn-processor">
          <Cpu className="h-3.5 w-3.5" /> Procesador
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 bg-slate-800" />

        <TBButton title="Nuevo proyecto" onClick={s.newProject}>
          <FilePlus2 className="h-4 w-4" />
        </TBButton>
        <TBButton title="Exportar JSON" onClick={saveJson} testId="btn-export">
          <Download className="h-4 w-4" />
        </TBButton>
        <TBButton title="Importar JSON" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
        </TBButton>
        <TBButton title="Compartir link" onClick={share} testId="btn-share">
          <Share2 className="h-4 w-4" />
        </TBButton>
        <TBButton title="Ayuda y atajos" onClick={() => s.setHelpOpen(true)}>
          <Keyboard className="h-4 w-4" />
        </TBButton>
      </div>

      {/* ══════════ MOBILE — fila 1: logo + nombre + menú ══════════ */}
      <div className="flex h-12 items-center gap-1.5 px-2 md:hidden">
        <ChipLogo />
        <input
          value={s.projectName}
          onChange={(e) => useCircuit.setState({ projectName: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-200 outline-none transition-colors hover:border-slate-700 focus:border-cyan-700 focus:bg-[#0D1420]"
          aria-label="Nombre del proyecto"
        />
        {oscillationBadge}
        {overflowMenu}
      </div>

      {/* ══════════ MOBILE — fila 2: modo + simulación ══════════ */}
      <div className="flex h-11 items-center gap-1 overflow-x-auto px-1.5 md:hidden">
        {modeToggle}
        {simControls}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = "";
        }}
      />
    </header>
  );
}
