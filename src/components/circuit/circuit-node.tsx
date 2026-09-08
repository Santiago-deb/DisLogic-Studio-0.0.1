// ============================================================
// DisLogic — Nodo de circuito: símbolos IEEE/ANSI + valores en vivo
// ============================================================
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CATALOG, getDef } from "@/lib/circuit/catalog";
import type { ComponentType, Pin, SignalValue } from "@/lib/circuit/types";

export const HEADER_H = 24;
export const PIN_PITCH = 20;
const PIN_R = 5;

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

export function nodeGeometry(type: ComponentType, props: Record<string, unknown>) {
  const pins = pinsOf(type, props);
  const nIn = pins.filter((p) => p.direction === "input").length;
  const nOut = pins.filter((p) => p.direction === "output").length;
  const bodyH = Math.max(nIn, nOut, 1) * PIN_PITCH + 10;
  const width = blockWidth(type, props);
  return { pins, nIn, nOut, bodyH, width, height: HEADER_H + bodyH };
}

function blockWidth(type: ComponentType, props: Record<string, unknown>): number {
  switch (type) {
    case "INPUT_PIN":
    case "OUTPUT_PIN":
    case "POWER":
    case "GROUND":
      return 96;
    case "CLOCK":
    case "TUNNEL":
    case "PROBE":
    case "CONSTANT":
      return 104;
    case "MUX":
    case "DMUX":
      return (1 << ((props.nSel as number) ?? 1)) > 8 ? 132 : 116;
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

function pinY(index: number, total: number, bodyH: number): number {
  return HEADER_H + (bodyH / (total + 1)) * (index + 1);
}

// ---------------- formato de valores ----------------

export function fmtValue(v: SignalValue, width: number): string {
  if (v === undefined) return "··";
  if (width === 1) return v ? "1" : "0";
  return v.toString(16).toUpperCase();
}

function valueColor(v: SignalValue): string {
  if (v === undefined) return "#55637A";
  const active = v !== 0;
  return active ? "#00FF88" : "#FF4444";
}

// ---------------- símbolos de compuertas (IEEE/ANSI) ----------------

function GateSymbol({ type, nIn, bodyH, width }: { type: ComponentType; nIn: number; bodyH: number; width: number }) {
  const gw = 64;
  const gh = Math.min(bodyH - 8, 64);
  const gy = (bodyH - gh) / 2;
  const gx = 26;
  const stroke = "#9FB3C8";
  const bubble = type === "NAND" || type === "NOR" || type === "XNOR" || type === "NOT";

  const shape = () => {
    switch (type) {
      case "AND":
      case "NAND":
        return (
          <path
            d={`M${gx},${gy} h${gw * 0.45} a${gh / 2},${gh / 2} 0 0 1 0,${gh} h-${gw * 0.45} z`}
            fill="#0F1624"
            stroke={stroke}
            strokeWidth={1.6}
          />
        );
      case "OR":
      case "NOR":
      case "XOR":
      case "XNOR":
        return (
          <>
            {type === "XOR" || type === "XNOR" ? (
              <path
                d={`M${gx - 7},${gy} q10,${gh / 2} 0,${gh}`}
                fill="none"
                stroke={stroke}
                strokeWidth={1.6}
              />
            ) : null}
            <path
              d={`M${gx},${gy} q${gw * 0.32},0 ${gw * 0.62},${gh / 2} q-${gw * 0.3},${gh / 2} -${gw * 0.62},${gh / 2} q${gw * 0.14},-${gh / 2} 0,-${gh} z`}
              fill="#0F1624"
              stroke={stroke}
              strokeWidth={1.6}
            />
          </>
        );
      case "NOT":
      case "BUFFER":
        return (
          <path
            d={`M${gx},${gy + 4} L${gx + gw * 0.75},${gy + gh / 2} L${gx},${gy + gh - 4} z`}
            fill="#0F1624"
            stroke={stroke}
            strokeWidth={1.6}
          />
        );
      case "TRI_STATE_BUFFER":
        return (
          <>
            <path
              d={`M${gx},${gy + 4} L${gx + gw * 0.7},${gy + gh / 2} L${gx},${gy + gh - 4} z`}
              fill="#0F1624"
              stroke={stroke}
              strokeWidth={1.6}
            />
            <line x1={gx} y1={gy - 2} x2={gx} y2={gy + gh + 2} stroke={stroke} strokeWidth={1.2} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <svg width={width} height={bodyH} className="pointer-events-none absolute inset-0">
      {/* líneas de entrada */}
      {Array.from({ length: nIn }, (_, i) => {
        const y = pinY(i, nIn, bodyH);
        const startX = type === "XOR" || type === "XNOR" ? gx - 8 : gx;
        return <line key={i} x1={4} y1={y} x2={startX} y2={y} stroke={stroke} strokeWidth={1.4} />;
      })}
      {shape()}
      {bubble && (
        <circle
          cx={type === "NOT" || type === "BUFFER" || type === "TRI_STATE_BUFFER" ? gx + gw * 0.75 + 3.5 : gx + gw * 0.45 + gh / 2 + 3.5}
          cy={bodyH / 2}
          r={3.5}
          fill="#0F1624"
          stroke={stroke}
          strokeWidth={1.4}
        />
      )}
      <line
        x1={bubble ? (type === "NOT" || type === "BUFFER" || type === "TRI_STATE_BUFFER" ? gx + gw * 0.75 + 7 : gx + gw * 0.45 + gh / 2 + 7) : gx + gw * 0.62}
        y1={bodyH / 2}
        x2={width - 4}
        y2={bodyH / 2}
        stroke={stroke}
        strokeWidth={1.4}
      />
    </svg>
  );
}

function PlexusSymbol({ type, bodyH, width, nIn, nOut }: { type: ComponentType; bodyH: number; width: number; nIn: number; nOut: number }) {
  const stroke = "#9FB3C8";
  const h = bodyH - 6;
  const y = 3;
  if (type === "MUX") {
    const notch = 14;
    return (
      <svg width={width} height={bodyH} className="pointer-events-none absolute inset-0">
        <path
          d={`M20,${y} H${width - 20 - notch} L${width - 20},${y + h} H20 Z`}
          fill="#0F1624"
          stroke={stroke}
          strokeWidth={1.6}
        />
        {Array.from({ length: nIn }, (_, i) => (
          <line key={i} x1={4} y1={pinY(i, nIn, bodyH)} x2={20} y2={pinY(i, nIn, bodyH)} stroke={stroke} strokeWidth={1.3} />
        ))}
        <line x1={width - 20} y1={bodyH / 2} x2={width - 4} y2={bodyH / 2} stroke={stroke} strokeWidth={1.3} />
        <text x={width / 2} y={bodyH / 2 + 3.5} textAnchor="middle" fontSize={9} fill="#5B7391" fontFamily="monospace">MUX</text>
      </svg>
    );
  }
  if (type === "DMUX") {
    const notch = 14;
    return (
      <svg width={width} height={bodyH} className="pointer-events-none absolute inset-0">
        <path
          d={`M20,${y + notch / 2} L${20 + notch},${y} H${width - 20} L${width - 20},${y + h} H${20 + notch} Z`}
          fill="#0F1624"
          stroke={stroke}
          strokeWidth={1.6}
          transform={`translate(0,${-notch / 4})`}
        />
        {Array.from({ length: nOut }, (_, i) => (
          <line key={i} x1={width - 20} y1={pinY(i, nOut, bodyH)} x2={width - 4} y2={pinY(i, nOut, bodyH)} stroke={stroke} strokeWidth={1.3} />
        ))}
      </svg>
    );
  }
  return null;
}

// ---------------- cuerpo por tipo ----------------

function BlockBody({
  type,
  compId,
  props,
  states,
  values,
  bodyH,
  width,
  mode,
  running,
}: {
  type: ComponentType;
  compId: string;
  props: Record<string, unknown>;
  states: Record<string, unknown>;
  values: Record<string, SignalValue>;
  bodyH: number;
  width: number;
  mode: "edit" | "sim";
  running: boolean;
}) {
  const short = getDef(type)?.short ?? "?";
  const catColor = "#00AAFF";
  const center = "absolute inset-0 flex items-center justify-center";
  // valores con clave completa "compId:pinId"
  const val = (pin: string): SignalValue => values[`${compId}:${pin}`];

  const badge = (v: SignalValue, w: number) => (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
      style={{ color: valueColor(v), background: "#0D1420", border: `1px solid ${valueColor(v)}55` }}
    >
      {fmtValue(v, w)}
    </span>
  );

  switch (type) {
    case "INPUT_PIN": {
      const v = val("out");
      return (
        <div className={center}>
          <div
            className="flex h-6 w-14 items-center justify-center rounded-md font-mono text-xs font-bold transition-all"
            style={{
              background: v === 1 ? "#00FF8822" : "#FF444422",
              color: valueColor(v),
              border: `1.5px solid ${valueColor(v)}`,
              boxShadow: v === 1 ? "0 0 8px #00FF8866" : "none",
            }}
          >
            {v === 1 ? "1" : "0"}
          </div>
        </div>
      );
    }
    case "OUTPUT_PIN": {
      const v = val("in0");
      return (
        <div className={center}>
          <div
            className="h-5 w-5 rounded-full transition-all"
            style={{
              background: v === 1 ? "#00FF88" : "#3A1220",
              border: `2px solid ${valueColor(v)}`,
              boxShadow: v === 1 ? "0 0 12px #00FF88" : "inset 0 0 6px #000",
            }}
          />
        </div>
      );
    }
    case "CLOCK": {
      const level = val("out");
      return (
        <div className={center}>
          <svg width={54} height={18} viewBox="0 0 54 18">
            <polyline
              points="0,14 8,14 8,4 18,4 18,14 28,14 28,4 38,4 38,14 48,14 48,4 54,4"
              fill="none"
              stroke="#00AAFF"
              strokeWidth={1.6}
              strokeDasharray={running ? undefined : "3 2"}
            >
              {running && <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />}
            </polyline>
          </svg>
          <span
            className="absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
            style={{ background: level === 1 ? "#00FF88" : "#FF4444", boxShadow: level === 1 ? "0 0 6px #00FF88" : "none" }}
          />
        </div>
      );
    }
    case "PROBE": {
      const w = (props.probeWidth as number) ?? 8;
      const fmt = (props.format as string) ?? "dec";
      const v = val("in0");
      const txt = v === undefined ? "···" : fmt === "bin" ? v.toString(2).padStart(w, "0") : fmt === "hex" ? "0x" + v.toString(16).toUpperCase() : String(v);
      return (
        <div className={center}>
          <span className="rounded bg-[#0D1420] px-2 py-0.5 font-mono text-sm font-bold ring-1 ring-slate-700" style={{ color: valueColor(v) }}>
            {txt}
          </span>
        </div>
      );
    }
    case "CONSTANT": {
      const w = (props.bits as number) ?? 1;
      const v = (props.value as number) ?? 0;
      return (
        <div className={center}>
          {badge(w === 1 ? v : v, w)}
        </div>
      );
    }
    case "POWER":
    case "GROUND":
      return (
        <div className={center}>
          <span className="font-mono text-xs font-bold" style={{ color: type === "POWER" ? "#00FF88" : "#FF4444" }}>
            {type === "POWER" ? "VCC" : "GND"}
          </span>
        </div>
      );
    case "TUNNEL":
      return (
        <div className={center}>
          <span className="rounded-full bg-[#0D1420] px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-300 ring-1 ring-cyan-700">
            {(props.label as string) ?? "A"}
          </span>
        </div>
      );
    case "RAM": {
      const ab = (props.addrBits as number) ?? 8;
      return (
        <div className={`${center} flex-col gap-0.5`}>
          <span className="font-mono text-[10px] text-slate-400">{1 << ab} × {(props.dataBits as number) ?? 8}b</span>
        </div>
      );
    }
    default: {
      // bloque genérico con valor de estado si existe
      const st = states?.data;
      const isReg = type === "REG_PIPO" || type === "REG_UNIVERSAL" || type.startsWith("COUNTER");
      const w = (props.bits as number) ?? 4;
      return (
        <div className={`${center} flex-col gap-1`}>
          <span className="font-mono text-[11px] font-bold tracking-wide" style={{ color: catColor }}>
            {short}
          </span>
          {isReg && (
            <span
              className="rounded px-1.5 font-mono text-[11px] font-bold"
              style={{
                color: "#00FF88",
                background: "#0D1420",
                border: "1px solid #00FF8844",
              }}
            >
              0x{Number(st ?? 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0")}
            </span>
          )}
          {type === "FF_D" || type === "FF_JK" || type === "FF_T" || type === "LATCH_D" || type === "LATCH_SR" ? (
            <span
              className="h-3 w-3 rounded-full"
              style={{
                background: val("q") === 1 ? "#00FF88" : "#FF4444",
                boxShadow: val("q") === 1 ? "0 0 8px #00FF88" : "none",
              }}
            />
          ) : null}
        </div>
      );
    }
  }
}

// ---------------- nodo principal ----------------

const CircuitNodeInner = ({ id, data }: NodeProps<CircuitFlowNode>) => {
  const type = data.compType;
  const def = getDef(type);
  if (!def) return null;
  const { pins, nIn, nOut, bodyH, width } = nodeGeometry(type, data.props);
  const inPins = pins.filter((p) => p.direction === "input");
  const outPins = pins.filter((p) => p.direction === "output");

  const isGate = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "TRI_STATE_BUFFER"].includes(type);
  const isPlexus = type === "MUX" || type === "DMUX";
  const accent =
    def.category === "gates" ? "#00AAFF"
    : def.category === "sequential" ? "#00FF88"
    : def.category === "arithmetic" ? "#FFCB6B"
    : def.category === "plexers" ? "#C792EA"
    : def.category === "synthesis" ? "#FF8A65"
    : def.category === "processor" ? "#EF5350"
    : "#8B98A5";

  return (
    <div
      className="rounded-lg transition-shadow"
      style={{
        width,
        background: "linear-gradient(180deg,#131A26 0%,#0F1521 100%)",
        border: `1.5px solid ${data.selected ? accent : "#263244"}`,
        boxShadow: data.selected
          ? `0 0 0 2px ${accent}55, 0 4px 16px #000a`
          : data.unstable
            ? "0 0 0 2px #FF4444, 0 0 14px #FF444488"
            : "0 2px 8px #0008",
      }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between gap-1 rounded-t-[6px] px-2"
        style={{ height: HEADER_H, background: `${accent}14`, borderBottom: `1px solid ${accent}30` }}
      >
        <span className="truncate text-[10px] font-semibold tracking-wide" style={{ color: accent }} title={data.label}>
          {data.label}
        </span>
        {data.mode === "sim" && def.clickable && (
          <span className="text-[8px] uppercase tracking-wider text-slate-500">clic</span>
        )}
      </div>

      {/* cuerpo */}
      <div className="relative" style={{ height: bodyH }}>
        {isGate && <GateSymbol type={type} nIn={nIn} bodyH={bodyH} width={width} />}
        {isPlexus && <PlexusSymbol type={type} bodyH={bodyH} width={width} nIn={nIn} nOut={nOut} />}
        {!isGate && !isPlexus && (
          <BlockBody
            type={type}
            compId={id}
            props={data.props}
            states={data.states ?? {}}
            values={data.values ?? {}}
            bodyH={bodyH}
            width={width}
            mode={data.mode}
            running={data.running}
          />
        )}
      </div>

      {/* pines de entrada */}
      {inPins.map((pin, i) => {
        const y = pinY(i, inPins.length, bodyH);
        const val = data.values?.[`${id}:${pin.id}`];
        const driven = data.driven?.[`${id}:${pin.id}`] ?? false;
        const isClk = pin.id === "clk";
        return (
          <div key={pin.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={pin.id}
              style={{
                top: y - PIN_R,
                left: -PIN_R,
                width: PIN_R * 2,
                height: PIN_R * 2,
                background: val === undefined ? (driven ? "#131A26" : "#131A26") : valueColor(val),
                border: `1.6px solid ${val === undefined ? (driven ? "#55637A" : "#FF4444AA") : valueColor(val)}`,
                borderRadius: isClk ? "2px" : "50%",
              }}
            />
            <span
              className="pointer-events-none absolute font-mono text-[8px] text-slate-500"
              style={{ top: y - 6, left: 7 }}
            >
              {pin.name}
            </span>
          </div>
        );
      })}

      {/* pines de salida */}
      {outPins.map((pin, i) => {
        const y = pinY(i, outPins.length, bodyH);
        const val = data.values?.[`${id}:${pin.id}`];
        const showValue = data.mode === "sim";
        return (
          <div key={pin.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={pin.id}
              style={{
                top: y - PIN_R,
                right: -PIN_R,
                width: PIN_R * 2,
                height: PIN_R * 2,
                background: val === undefined ? "#131A26" : valueColor(val),
                border: `1.6px solid ${val === undefined ? "#55637A" : valueColor(val)}`,
              }}
            />
            {pin.name !== "out" && (
              <span
                className="pointer-events-none absolute font-mono text-[8px] text-slate-500"
                style={{ top: y - 6, right: 7 }}
              >
                {pin.name}
              </span>
            )}
            {showValue && (
              <span
                className="pointer-events-none absolute rounded px-1 font-mono text-[9px] font-bold"
                style={{
                  top: y - 7,
                  right: -26,
                  color: valueColor(val),
                  background: "#0D1420",
                  border: `1px solid ${valueColor(val)}44`,
                }}
              >
                {fmtValue(val, pin.width)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const CircuitNode = memo(CircuitNodeInner);

export { CATALOG };
