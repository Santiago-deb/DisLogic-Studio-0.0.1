// Una pieza del circuito. Las compuertas son el símbolo solo, sobre la hoja; lo demás es un chip o un instrumento.
"use client";

import { memo, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps, type Node } from "@xyflow/react";
import { getDef } from "@/lib/circuit/catalog";
import type { ComponentType, Pin, SignalValue } from "@/lib/circuit/types";
import { COMPUERTAS, SimboloCompuerta, SimboloPlexor, colorSenal, posPin } from "./simbolos";

export const PIN_PITCH = 20;

export interface CircuitNodeData {
  compType: ComponentType;
  label: string;
  props: Record<string, unknown>;
  selected: boolean;
  mode: "edit" | "sim";
  values: Record<string, SignalValue>;
  driven: Record<string, boolean>;
  running: boolean;
  unstable: boolean;
  states: Record<string, unknown>;
  [key: string]: unknown;
}

export type CircuitFlowNode = Node<CircuitNodeData, "circuit">;

// ---------------- geometría ----------------

export function pinsOf(type: ComponentType, props: Record<string, unknown>): Pin[] {
  const def = getDef(type);
  if (!def) return [];
  const defs = typeof def.pins === "function" ? def.pins(props) : def.pins;
  return defs.map((p) => ({ ...p, width: typeof p.width === "function" ? p.width(props) : p.width }));
}

function anchoDe(type: ComponentType, props: Record<string, unknown>): number {
  if (COMPUERTAS.includes(type)) return 92;
  switch (type) {
    case "INPUT_PIN":
    case "OUTPUT_PIN":
    case "POWER":
    case "GROUND":
      return 72;
    case "CLOCK":
    case "TUNNEL":
    case "PROBE":
    case "CONSTANT":
      return 92;
    case "MUX":
    case "DMUX":
      return (1 << ((props.nSel as number) ?? 1)) > 8 ? 132 : 112;
    case "RAM":
    case "PLA":
      return 150;
    case "REGISTER_FILE":
    case "ADDER_SUBTRACTOR":
      return 148;
    default:
      return 128;
  }
}

export function nodeGeometry(type: ComponentType, props: Record<string, unknown>) {
  const pins = pinsOf(type, props);
  const nIn = pins.filter((p) => p.direction === "input").length;
  const nOut = pins.filter((p) => p.direction === "output").length;
  const bodyH = Math.max(nIn, nOut, 1) * PIN_PITCH + 10;
  const width = anchoDe(type, props);
  return { pins, nIn, nOut, bodyH, width, height: bodyH };
}

// ---------------- valores ----------------

export function fmtValue(v: SignalValue, width: number): string {
  if (v === undefined) return "?";
  if (width === 1) return v ? "1" : "0";
  return v.toString(16).toUpperCase();
}

const centro = "absolute inset-0 flex items-center justify-center";

// ---------------- instrumentos y chips ----------------

/** Interruptor deslizante: la entrada que se toca. */
function Interruptor({ v }: { v: SignalValue }) {
  const alto = v === 1;
  return (
    <div className={centro}>
      <div className="relative h-[22px] w-[46px] border-[1.5px] border-tinta bg-hoja">
        <div
          className="absolute top-[2px] flex h-[15px] w-[18px] items-center justify-center font-mono text-[11px] font-bold transition-[left] duration-100 motion-reduce:transition-none"
          style={{ left: alto ? 23 : 2, background: alto ? "var(--alto)" : "var(--tinta)", color: "var(--papel)" }}
        >
          {alto ? "1" : "0"}
        </div>
      </div>
    </div>
  );
}

/** LED de salida: lleno y con el valor adentro, se lee sin depender del color. */
function Led({ v, sim }: { v: SignalValue; sim: boolean }) {
  const alto = v === 1;
  return (
    <div className={centro}>
      <div
        className="flex h-[24px] w-[24px] items-center justify-center rounded-full border-[1.5px] border-tinta font-mono text-[12px] font-bold"
        style={{ background: alto ? "var(--alto)" : "var(--hoja)", color: alto ? "var(--papel)" : "var(--tinta-2)" }}
      >
        {sim ? fmtValue(v, 1) : ""}
      </div>
    </div>
  );
}

/** Cuánto hay entre el cuerpo de un instrumento y su pin: ahí va la patita. */
const PATITA: Partial<Record<ComponentType, number>> = { INPUT_PIN: 13, OUTPUT_PIN: 24, CLOCK: 16, CONSTANT: 30, POWER: 16, GROUND: 16, TUNNEL: 5 };

function CuerpoBloque({
  type,
  compId,
  props,
  states,
  values,
  mode,
  running,
}: {
  type: ComponentType;
  compId: string;
  props: Record<string, unknown>;
  states: Record<string, unknown>;
  values: Record<string, SignalValue>;
  mode: "edit" | "sim";
  running: boolean;
}) {
  const short = getDef(type)?.short ?? "?";
  const sim = mode === "sim";
  const val = (pin: string): SignalValue => values[`${compId}:${pin}`];

  switch (type) {
    case "INPUT_PIN":
      return <Interruptor v={val("out")} />;
    case "OUTPUT_PIN":
      return <Led v={val("in0")} sim={sim} />;
    case "CLOCK": {
      const nivel = val("out");
      return (
        <div className={centro}>
          <svg width={60} height={20} viewBox="0 0 60 20" aria-hidden>
            <polyline
              points="2,16 12,16 12,4 26,4 26,16 40,16 40,4 54,4 54,16 58,16"
              fill="none"
              stroke={sim && running ? colorSenal(nivel, true) : "var(--tinta)"}
              strokeWidth={1.8}
            />
          </svg>
        </div>
      );
    }
    case "PROBE": {
      const w = (props.probeWidth as number) ?? 8;
      const fmt = (props.format as string) ?? "dec";
      const v = val("in0");
      const txt = v === undefined ? "?" : fmt === "bin" ? v.toString(2).padStart(w, "0") : fmt === "hex" ? "0x" + v.toString(16).toUpperCase() : String(v);
      return (
        <div className={`${centro} border-[1.5px] border-tinta bg-hoja`}>
          <span className="font-mono text-[13px] font-bold text-tinta">{txt}</span>
        </div>
      );
    }
    case "CONSTANT": {
      const w = (props.bits as number) ?? 1;
      return (
        <div className={centro}>
          <span className="font-mono text-[14px] font-bold text-tinta">{fmtValue((props.value as number) ?? 0, w)}</span>
        </div>
      );
    }
    case "POWER":
      return (
        <div className={centro}>
          <svg width={40} height={24} viewBox="0 0 40 24" aria-hidden>
            <path d="M8 3V21M8 12H40" fill="none" stroke="var(--tinta)" strokeWidth={1.8} />
          </svg>
          <span className="absolute left-1 top-0 font-mono text-[10px] text-tinta-2">VCC</span>
        </div>
      );
    case "GROUND":
      return (
        <div className={centro}>
          <svg width={40} height={24} viewBox="0 0 40 24" aria-hidden>
            <path d="M40 12H16M16 2V22M11 6V18M6 9V15" fill="none" stroke="var(--tinta)" strokeWidth={1.8} />
          </svg>
          <span className="absolute right-1 top-0 font-mono text-[10px] text-tinta-2">GND</span>
        </div>
      );
    case "TUNNEL":
      return (
        <div className={centro}>
          <svg width={84} height={24} viewBox="0 0 84 24" className="absolute" aria-hidden>
            <path d="M12 2H82V22H12L2 12Z" fill="var(--hoja)" stroke="var(--tinta)" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
          <span className="relative font-mono text-[12px] font-bold text-tinta">{(props.label as string) ?? "A"}</span>
        </div>
      );
    case "RAM": {
      const ab = (props.addrBits as number) ?? 8;
      return (
        <div className={`${centro} flex-col`}>
          <span className="font-mono text-[12px] font-bold text-tinta">RAM</span>
          <span className="font-mono text-[11px] text-tinta-2">
            {1 << ab} × {(props.dataBits as number) ?? 8}
          </span>
        </div>
      );
    }
    default: {
      const st = states?.data;
      const esRegistro = type === "REG_PIPO" || type === "REG_UNIVERSAL" || type.startsWith("COUNTER");
      const w = (props.bits as number) ?? 4;
      return (
        <div className={`${centro} flex-col gap-0.5`}>
          <span className="font-mono text-[12px] font-bold text-tinta">{short}</span>
          {esRegistro && sim && (
            <span className="font-mono text-[12px] text-tinta">
              0x{Number(st ?? 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0")}
            </span>
          )}
        </div>
      );
    }
  }
}

// ---------------- pieza ----------------

const SIN_NOMBRES_DE_PIN: ComponentType[] = ["INPUT_PIN", "OUTPUT_PIN", "CLOCK", "PROBE", "CONSTANT", "POWER", "GROUND", "TUNNEL", ...COMPUERTAS];
const ES_INSTRUMENTO: ComponentType[] = ["INPUT_PIN", "OUTPUT_PIN", "CLOCK", "PROBE", "CONSTANT", "POWER", "GROUND", "TUNNEL"];

const CircuitNodeInner = ({ id, data }: NodeProps<CircuitFlowNode>) => {
  const type = data.compType;
  const def = getDef(type);
  const { pins, nIn, bodyH, width } = nodeGeometry(type, data.props);

  // Si cambian los pines sin que cambie el tamaño, React Flow no se entera solo.
  const firmaPines = pins.map((p) => p.id).join();
  const actualizar = useUpdateNodeInternals();
  useEffect(() => actualizar(id), [actualizar, id, firmaPines, bodyH, width]);

  if (!def) return null;
  const inPins = pins.filter((p) => p.direction === "input");
  const outPins = pins.filter((p) => p.direction === "output");
  const sim = data.mode === "sim";
  const valor = (pin: string) => data.values?.[`${id}:${pin}`];

  const esCompuerta = COMPUERTAS.includes(type);
  const esPlexor = type === "MUX" || type === "DMUX";
  const esChip = !esCompuerta && !esPlexor && !ES_INSTRUMENTO.includes(type);
  const conNombres = !SIN_NOMBRES_DE_PIN.includes(type);
  const nombrePropio = data.label && data.label !== def.label ? data.label : null;

  const contorno = data.selected
    ? "1.5px dashed var(--sel)"
    : sim && data.unstable
      ? "1.5px dashed var(--fallo)"
      : "none";

  return (
    <div className="relative" style={{ width, height: bodyH, outline: contorno, outlineOffset: 4 }} data-testid={`pieza-${type}`}>
      {nombrePropio && (
        <span className="pointer-events-none absolute -top-[18px] left-0 max-w-full truncate text-[12px] text-tinta" title={nombrePropio}>
          {nombrePropio}
        </span>
      )}

      {esChip && <div className="absolute inset-y-0 left-[10px] right-[10px] border-[1.6px] border-tinta bg-hoja" />}

      {esCompuerta && (
        <SimboloCompuerta
          tipo={type}
          nEntradas={nIn}
          alto={bodyH}
          ancho={width}
          sim={sim}
          entradas={inPins.map((p) => valor(p.id))}
          salida={outPins[0] ? valor(outPins[0].id) : undefined}
        />
      )}
      {esPlexor && <SimboloPlexor tipo={type as "MUX" | "DMUX"} ancho={width} alto={bodyH} />}
      {!esCompuerta && !esPlexor && (
        <CuerpoBloque type={type} compId={id} props={data.props} states={data.states ?? {}} values={data.values ?? {}} mode={data.mode} running={data.running} />
      )}
      {esPlexor && (
        <div className={centro}>
          <span className="font-mono text-[12px] font-bold text-tinta">{type}</span>
        </div>
      )}

      {inPins.map((pin, i) => {
        const y = posPin(i, inPins.length, bodyH);
        const esReloj = pin.id === "clk";
        return (
          <div key={pin.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={pin.id}
              className={esReloj ? "reloj" : undefined}
              style={{ top: y, left: 0, ["--pin" as string]: colorSenal(valor(pin.id), sim) }}
            />
            {(esChip || esPlexor) && <span className="pointer-events-none absolute left-0 h-[1.6px] w-[12px] bg-tinta" style={{ top: y - 0.8 }} />}
            {PATITA[type] !== undefined && <span className="pointer-events-none absolute left-0 h-[1.6px]" style={{ top: y - 0.8, width: PATITA[type], background: colorSenal(valor(pin.id), sim) }} />}
            {esReloj && esChip ? (
              <svg className="pointer-events-none absolute" style={{ left: 11, top: y - 6 }} width={9} height={12} aria-hidden>
                <path d="M0 0L8 6L0 12" fill="none" stroke="var(--tinta)" strokeWidth={1.3} />
              </svg>
            ) : (
              conNombres && (
                <span className="pointer-events-none absolute font-mono text-[10px] leading-3 text-tinta-2" style={{ top: y - 6, left: esPlexor ? 18 : 15 }}>
                  {pin.name}
                </span>
              )
            )}
          </div>
        );
      })}

      {outPins.map((pin, i) => {
        const y = posPin(i, outPins.length, bodyH);
        const v = valor(pin.id);
        return (
          <div key={pin.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={pin.id}
              style={{ top: y, right: 0, left: "auto", ["--pin" as string]: colorSenal(v, sim) }}
            />
            {(esChip || esPlexor) && <span className="pointer-events-none absolute right-0 h-[1.6px] w-[12px] bg-tinta" style={{ top: y - 0.8 }} />}
            {PATITA[type] !== undefined && <span className="pointer-events-none absolute right-0 h-[1.6px]" style={{ top: y - 0.8, width: PATITA[type], background: colorSenal(v, sim) }} />}
            {conNombres && pin.name !== "out" && (
              <span className="pointer-events-none absolute font-mono text-[10px] leading-3 text-tinta-2" style={{ top: y - 6, right: esPlexor ? 18 : 15 }}>
                {pin.name}
              </span>
            )}
            {sim && pin.width > 1 && v !== undefined && (
              <span className="pointer-events-none absolute left-full ml-1 whitespace-nowrap font-mono text-[11px] font-bold text-tinta" style={{ top: y - 16 }}>
                {fmtValue(v, pin.width)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const CircuitNode = memo(CircuitNodeInner);
