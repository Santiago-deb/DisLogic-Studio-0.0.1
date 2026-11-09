// La barra de instrumento: nombre del proyecto, editar o simular, el reloj, y lo demás en menús con nombre.
"use client";

import { useRef } from "react";
import { useCircuit } from "@/lib/circuit/store";
import { circuitoAFragmento, validarCircuito } from "@/lib/circuit/compartir";
import type { CircuitData } from "@/lib/circuit/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Play, Pause, SkipForward, RotateCcw, Undo2, Redo2, Maximize, Moon, Sun, ChevronDown, Menu } from "lucide-react";

const icono = "flex h-8 w-8 shrink-0 items-center justify-center text-tinta hover:bg-hoja-2 disabled:text-linea-fuerte disabled:hover:bg-transparent";
const texto = "flex h-8 shrink-0 items-center gap-1 px-2.5 text-[13px] text-tinta hover:bg-hoja-2";

function Boton({ titulo, children, ...resto }: { titulo: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button aria-label={titulo} className={icono} {...resto}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{titulo}</TooltipContent>
    </Tooltip>
  );
}

/** El símbolo de la compuerta AND es, también, una D. */
function Marca() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 pr-1">
      <svg width={24} height={20} viewBox="0 0 24 20" aria-hidden>
        <path d="M6 2h6a8 8 0 0 1 0 16H6z" fill="none" stroke="var(--tinta)" strokeWidth={2} />
        <path d="M0 6.5h6M0 13.5h6M20 10h4" stroke="var(--tinta)" strokeWidth={2} />
      </svg>
      <h1 className="sr-only text-[15px] font-bold text-tinta lg:not-sr-only">DisLogic</h1>
    </span>
  );
}

function BotonTema() {
  const cambiar = () => {
    const nuevo = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem("dislogic:tema", nuevo);
    } catch {
      /* sin almacenamiento: dura esta visita */
    }
  };
  return (
    <Boton titulo="Cambiar entre hoja clara y placa oscura" onClick={cambiar} data-testid="btn-tema">
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </Boton>
  );
}

export function TopBar() {
  const s = useCircuit();
  const archivoRef = useRef<HTMLInputElement>(null);
  const enSim = s.mode === "sim";

  const exportar = () => {
    const data = s.getCircuit();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, "_")}.dislogic.json`;
    a.click();
    URL.revokeObjectURL(url);
    s.pushLog("success", "Proyecto exportado como JSON.");
  };

  const importar = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      let circuito: CircuitData | null = null;
      try {
        circuito = validarCircuito(JSON.parse(r.result as string));
      } catch {
        /* no es JSON: se avisa abajo */
      }
      if (circuito) {
        s.loadCircuit(circuito);
        setTimeout(() => window.dispatchEvent(new CustomEvent("dislogic:fit")), 60);
      } else s.pushLog("error", "No se importó: el archivo no es un proyecto de DisLogic válido.");
    };
    r.readAsText(f);
  };

  const compartir = async () => {
    const fragmento = await circuitoAFragmento(s.getCircuit());
    if (!fragmento) return s.pushLog("error", "No se compartió: el circuito es demasiado grande para un link. Exportalo como JSON.");
    s.setShareDialog(true, `${location.origin}${location.pathname}#${fragmento}`);
  };

  const opcionesArchivo = (
    <>
      <DropdownMenuItem onClick={s.newProject}>Nuevo proyecto</DropdownMenuItem>
      <DropdownMenuItem onClick={() => archivoRef.current?.click()}>Importar JSON</DropdownMenuItem>
      <DropdownMenuItem onClick={exportar} data-testid="menu-export">
        Exportar JSON
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={compartir} data-testid="menu-share">
        Compartir link
      </DropdownMenuItem>
    </>
  );

  const reloj = (
    <div className="flex shrink-0 items-center gap-1.5 px-1.5">
      <label htmlFor="reloj" className="text-[12px] text-tinta-2">
        Reloj
      </label>
      <input
        id="reloj"
        type="range"
        min={0.5}
        max={20}
        step={0.5}
        value={s.clockHz}
        disabled={!enSim}
        onChange={(e) => s.setClockHz(parseFloat(e.target.value))}
        className="h-1 w-16 accent-[var(--tinta)] disabled:opacity-50"
      />
      <span className="w-12 font-mono text-[12px] text-tinta">{s.clockHz} Hz</span>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-0 border-b border-linea-fuerte bg-papel px-2 py-1" data-testid="top-bar">
        <Marca />
        <input
          value={s.projectName}
          onChange={(e) => useCircuit.setState({ projectName: e.target.value })}
          aria-label="Nombre del proyecto"
          className="h-8 w-28 min-w-0 flex-1 border border-transparent bg-transparent px-1.5 text-[14px] text-tinta hover:border-linea md:w-44 md:flex-none"
        />

        <div className="mx-1 hidden h-5 w-px bg-linea md:block" />
        <Boton titulo="Deshacer (Ctrl+Z)" onClick={s.undo} disabled={s.private_undo.length === 0}>
          <Undo2 className="h-4 w-4" />
        </Boton>
        <Boton titulo="Rehacer (Ctrl+Shift+Z)" onClick={s.redo} disabled={s.private_redo.length === 0}>
          <Redo2 className="h-4 w-4" />
        </Boton>
        <div className="mx-1 hidden h-5 w-px bg-linea md:block" />

        {/* En el celular, los controles de simulación bajan a su propia fila. */}
        <div className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto md:overflow-visible">
          <div role="radiogroup" aria-label="Modo" className="flex shrink-0 border border-tinta">
            {(
              [
                ["edit", "Editar"],
                ["sim", "Simular"],
              ] as const
            ).map(([v, nombre]) => (
              <button
                key={v}
                role="radio"
                aria-checked={s.mode === v}
                onClick={() => s.setMode(v)}
                className={`h-[30px] px-3 text-[13px] font-bold ${s.mode === v ? "bg-tinta text-papel" : "text-tinta hover:bg-hoja-2"}`}
                data-testid={`mode-${v}`}
              >
                {nombre}
              </button>
            ))}
          </div>

          <Boton titulo={s.running ? "Pausar" : "Iniciar"} onClick={() => s.setRunning(!s.running)} disabled={!enSim} data-testid="btn-play">
            {s.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Boton>
          <Boton titulo="Avanzar un ciclo" onClick={s.stepSim} disabled={!enSim} data-testid="btn-step">
            <SkipForward className="h-4 w-4" />
          </Boton>
          <Boton titulo="Reiniciar simulación" onClick={s.resetSim} disabled={!enSim} data-testid="btn-reset">
            <RotateCcw className="h-4 w-4" />
          </Boton>
          {reloj}
          <button
            onClick={() => s.setTemporal(!s.temporal)}
            disabled={!enSim}
            aria-pressed={s.temporal}
            title="Usar los retardos reales de cada compuerta, en nanosegundos"
            className={`h-8 shrink-0 border px-2 text-[12px] ${s.temporal ? "border-tinta bg-hoja-2 font-bold text-tinta" : "border-transparent text-tinta-2 hover:text-tinta"}`}
            data-testid="btn-temporal"
          >
            Retardos
          </button>
          {s.oscillating && <span className="shrink-0 px-1 text-[12px] font-bold text-fallo md:hidden">Oscila</span>}
        </div>

        <div className="hidden flex-1 md:block" />

        <div className="ml-auto hidden items-center md:flex">
          <button className={texto} onClick={() => s.setExamplesOpen(true)} data-testid="btn-examples">
            Ejemplos
          </button>
          <button className={texto} onClick={() => s.setProcessorOpen(true)} data-testid="btn-processor">
            Procesador
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className={texto} data-testid="btn-archivo">
              Archivo <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              {opcionesArchivo}
            </DropdownMenuContent>
          </DropdownMenu>
          <button className={texto} onClick={() => s.setHelpOpen(true)}>
            Ayuda
          </button>
        </div>

        <Boton titulo="Ajustar a la pantalla" onClick={() => window.dispatchEvent(new CustomEvent("dislogic:fit"))}>
          <Maximize className="h-4 w-4" />
        </Boton>
        <BotonTema />

        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Más opciones" className={icono} data-testid="btn-menu">
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-52">
              <DropdownMenuItem onClick={() => s.setExamplesOpen(true)} data-testid="menu-examples">
                Ejemplos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => s.setProcessorOpen(true)} data-testid="menu-processor">
                Procesador
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {opcionesArchivo}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => s.setHelpOpen(true)}>Ayuda</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          ref={archivoRef}
          type="file"
          accept=".json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importar(f);
            e.target.value = "";
          }}
        />
      </header>
    </TooltipProvider>
  );
}
