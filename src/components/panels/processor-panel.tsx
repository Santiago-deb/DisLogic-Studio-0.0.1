"use client";

/**
 * Módulo 5 — Procesador de 8 bits de la cátedra.
 * UI de 3 columnas: assembler + RAM hex | datapath SVG animado | controles + log + análisis temporal + FAQ.
 */
import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCircuit } from "@/lib/circuit/store";
import {
  F_MAX_MHZ,
  Processor,
  REF_DELAYS,
  REG_ALU_OPS,
  T_MIN_NS,
  TIMING_TERMS,
  decodeByte,
  h2,
} from "@/lib/circuit/processor";
import type { AsmError, ControlSignals, ProcessorState } from "@/lib/circuit/processor";

const PRESETS = [
  {
    id: "suma",
    name: "Suma 3+5 → R7",
    code: `# Suma 3 + 5 y guarda el resultado en R7
LOADI 3       ; Acc = 3
STORE R0      ; R0 = 3
LOADI 5       ; Acc = 5
ADD R0        ; Acc = 5 + R0 = 8
STORE R7      ; R7 = 8
HALT`,
  },
  {
    id: "cuenta",
    name: "Cuenta regresiva con JZ",
    code: `# Cuenta regresiva de 5 a 0 (JZ lee el flag Z del ciclo anterior)
LOADI 1
STORE R1      ; R1 = 1 (decremento)
LOADI 5
STORE R0      ; R0 = contador
loop:
LOAD R0       ; Acc = R0
SUB R1        ; Acc = R0 - 1 (activa Z al llegar a 0)
STORE R0      ; guarda el contador
JZ fin        ; si Z=1 → salir
JMP loop
fin:
HALT`,
  },
  {
    id: "notshl",
    name: "Demo NOT / SHL + flags",
    code: `# Demo de NOT, SHL y SHR con flags Z C N
LOADI 0x0F    ; Acc = 00001111
NOT           ; Acc = 11110000 (N=1)
STORE R2
SHL           ; Acc = 11100000, C=1
STORE R3
SHL           ; Acc = 11000000, C=1
SHR           ; Acc = 01100000, C=0
STORE R4
HALT`,
  },
];

/* ---------- subcomponentes RAM ---------- */

const RamCell = memo(function RamCell({
  addr,
  value,
  isPc,
  isProg,
  onEdit,
}: {
  addr: number;
  value: number;
  isPc: boolean;
  isProg: boolean;
  onEdit: (addr: number, value: number) => void;
}) {
  const [text, setText] = useState(() => h2(value));
  const [previo, setPrevio] = useState(value);
  if (previo !== value) {
    setPrevio(value);
    setText(h2(value));
  }
  return (
    <input
      value={text}
      title={`0x${h2(addr)}${isPc ? ", acá está el PC" : ""}`}
      aria-label={`Memoria en 0x${h2(addr)}`}
      spellCheck={false}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(-2);
        setText(raw);
        const n = parseInt(raw, 16);
        onEdit(addr, raw.length === 0 || Number.isNaN(n) ? 0 : n & 0xff);
      }}
      onBlur={() => setText(h2(value))}
      onFocus={(e) => e.target.select()}
      className={`h-[17px] w-full min-w-0 rounded-[2px] border px-0 text-center font-mono text-[10px] leading-none tracking-tighter outline-none transition-colors ${
        isPc
          ? "border-sel bg-sel-suave text-tinta"
          : isProg
            ? "border-linea bg-hoja-2 text-tinta hover:border-linea"
            : "border-linea bg-hoja-2 text-tinta-2 hover:border-linea"
      }`}
    />
  );
});

const RamGrid = memo(function RamGrid({
  ram,
  pc,
  progLen,
  onEdit,
}: {
  ram: number[];
  pc: number;
  progLen: number;
  onEdit: (addr: number, value: number) => void;
}) {
  const cells: ReactNode[] = [];
  for (let row = 0; row < 16; row++) {
    cells.push(
      <div
        key={`h${row}`}
        className="flex h-[17px] items-center justify-end pr-1 font-mono text-[11px] text-tinta-2"
      >
        {h2(row * 16)}
      </div>,
    );
    for (let col = 0; col < 16; col++) {
      const addr = row * 16 + col;
      cells.push(
        <RamCell
          key={addr}
          addr={addr}
          value={ram[addr] ?? 0}
          isPc={addr === pc}
          isProg={addr < progLen}
          onEdit={onEdit}
        />,
      );
    }
  }
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: "20px repeat(16, minmax(0, 1fr))" }}>
      {cells}
    </div>
  );
});

/* ---------- helpers SVG del datapath ---------- */

const ON = "var(--alto)";
const OFF = "var(--linea-fuerte)";
const CYAN = "var(--sel)";

function SvgText({
  x,
  y,
  s = 9,
  f = "var(--tinta-2)",
  a = "middle",
  b = false,
  children,
}: {
  x: number;
  y: number;
  s?: number;
  f?: string;
  a?: "start" | "middle" | "end";
  b?: boolean;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={Math.max(s, 9.5)}
      fill={f}
      textAnchor={a}
      fontWeight={b ? 700 : 400}
      className="font-mono"
    >
      {children}
    </text>
  );
}

function BusPath({
  d,
  on,
  label,
  lx,
  ly,
}: {
  d: string;
  on: boolean;
  label?: string;
  lx?: number;
  ly?: number;
}) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={on ? ON : OFF}
        strokeWidth={on ? 2 : 1.2}
        strokeDasharray={on ? "6 3" : undefined}
        filter={on ? "url(#plGlow)" : undefined}
        markerEnd={on ? "url(#plArrOn)" : "url(#plArrOff)"}
        className={on ? "pl-flow" : undefined}
      />
      {label !== undefined && lx !== undefined && ly !== undefined ? (
        <SvgText x={lx} y={ly} s={7.5} f={on ? ON : "var(--tinta-2)"} a={lx > 460 ? "end" : "start"}>
          {label}
        </SvgText>
      ) : null}
    </g>
  );
}

function SignalStub({ x1, x2, y, on, name }: { x1: number; x2: number; y: number; on: boolean; name: string }) {
  return (
    <g>
      <path
        d={`M${x1},${y} H${x2}`}
        fill="none"
        stroke={on ? ON : OFF}
        strokeWidth={on ? 1.8 : 1}
        strokeDasharray="3 3"
        markerEnd={on ? "url(#plArrOn)" : "url(#plArrOff)"}
        filter={on ? "url(#plGlow)" : undefined}
      />
      <SvgText x={x2 - 4} y={y + 2.5} s={7} f={on ? ON : "var(--tinta-2)"} a="end">
        {name}
      </SvgText>
    </g>
  );
}

/* ---------- datapath ---------- */

function DatapathSvg({ state, sig }: { state: ProcessorState; sig: ControlSignals }) {
  const pcActive = sig.pcInc || sig.pcLoad;
  const readReg = REG_ALU_OPS.has(sig.aluOp) || sig.muxSel === "reg" ? state.lastReg : -1;
  const writeReg = sig.regWrite ? state.lastReg : -1;
  const aluOn = sig.aluOp !== "";
  const flags: [string, number][] = [
    ["Z", state.z],
    ["C", state.c],
    ["V", state.v],
    ["N", state.n],
  ];
  const muxLabel =
    sig.muxSel === "alu" ? "sel=0 ALU" : sig.muxSel === "imm" ? "sel=1 imm" : sig.muxSel === "reg" ? "sel=2 regs" : "sel=—";

  return (
    <svg viewBox="0 0 700 566" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <style>{`@keyframes plFlow { to { stroke-dashoffset: -27; } } .pl-flow { animation: plFlow .55s linear infinite; }`}</style>
      <defs>
        <filter id="plGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="700" height="566">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="plArrOn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={ON} />
        </marker>
        <marker id="plArrOff" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--linea-fuerte)" />
        </marker>
      </defs>

      {/* ===== caminos de datos ===== */}
      <BusPath d="M130,90 H240" on={sig.memRead} label={`dir 0x${h2(sig.addrBus)}`} lx={172} ly={84} />
      <BusPath d="M425,90 H530" on={sig.irWrite} label={`0x${h2(sig.ramOut)}`} lx={452} ly={84} />
      <BusPath d="M60,125 V175" on={sig.pcInc} />
      <BusPath d="M110,190 H205 V40 H95" on={sig.pcInc} label="+1" lx={122} ly={186} />
      <BusPath d="M425,45 H447 V10 H80 V24" on={sig.pcLoad} label="imm (target)" lx={455} ly={22} />
      <BusPath d="M610,125 V200" on={sig.irWrite} label="opcode" lx={616} ly={168} />

      {/* Regs puerto A → ALU (operando) */}
      <BusPath d="M170,300 H225 V355 H250" on={REG_ALU_OPS.has(sig.aluOp)} />
      {REG_ALU_OPS.has(sig.aluOp) && state.lastReg >= 0 ? (
        <SvgText x={178} y={294} s={7.5} f={ON} a="start">{`R${state.lastReg}=0x${h2(state.regs[state.lastReg] ?? 0)}`}</SvgText>
      ) : null}
      {/* Regs puerto B → MUX (LOAD) */}
      <BusPath d="M170,370 H200 V480 H460 V420 H470" on={sig.muxSel === "reg"} />
      {sig.muxSel === "reg" && state.lastReg >= 0 ? (
        <SvgText x={255} y={493} s={7.5} f={ON} a="start">{`Acc←R${state.lastReg}=0x${h2(state.regs[state.lastReg] ?? 0)}`}</SvgText>
      ) : null}

      {/* ALU → MUX (in 0) */}
      <BusPath d="M400,390 H425 V355 H470" on={sig.muxSel === "alu"} />
      {sig.muxSel === "alu" ? (
        <SvgText x={405} y={375} s={7.5} f={ON} a="start">{`0x${h2(sig.aluResult)}`}</SvgText>
      ) : null}
      {/* imm → MUX (in 1) */}
      <BusPath d="M425,120 H452 V388 H470" on={sig.muxSel === "imm"} label="imm" lx={438} ly={114} />
      {/* MUX → Acc */}
      <BusPath d="M540,388 H575" on={sig.accWrite} />
      {/* Acc → ALU (realimentación, entrada B) */}
      <BusPath d="M622,423 V470 H210 V425 H250" on={aluOn} label={`Acc=0x${h2(state.acc)}`} lx={430} ly={464} />
      {/* Acc → Regs (STORE, escritura) */}
      <BusPath d="M640,423 V500 H15 V468 H25" on={sig.regWrite} />
      {sig.regWrite && state.lastReg >= 0 ? (
        <SvgText x={280} y={513} s={7.5} f={ON} a="start">{`R${state.lastReg}←Acc (escritura)`}</SvgText>
      ) : null}

      {/* ===== señales de control desde la CU ===== */}
      <SignalStub x1={490} x2={455} y={215} on={sig.pcLoad} name="pcLoad" />
      <SignalStub x1={490} x2={455} y={229} on={sig.pcInc} name="pcInc" />
      <SignalStub x1={490} x2={455} y={243} on={sig.irWrite} name="irWrite" />
      <SignalStub x1={490} x2={455} y={257} on={sig.accWrite} name="accWrite" />
      <SignalStub x1={490} x2={455} y={271} on={sig.regWrite} name="regWrite" />
      <SignalStub x1={490} x2={455} y={285} on={sig.muxSel !== ""} name="muxSel" />
      <SignalStub x1={490} x2={455} y={299} on={aluOn} name="aluOp" />

      {/* ===== bloques ===== */}
      {/* PC */}
      <rect x={25} y={55} width={105} height={70} rx={1} fill="var(--hoja)" stroke={pcActive ? ON : "var(--linea-fuerte)"} strokeWidth={pcActive ? 1.8 : 1.2} />
      <SvgText x={77} y={74} s={9.5} f="var(--tinta)" b>PC</SvgText>
      <SvgText x={77} y={102} s={16} f={CYAN} b>{`0x${h2(state.pc)}`}</SvgText>
      <SvgText x={77} y={117} s={6.5} f="var(--tinta-2)">8 bits</SvgText>

      {/* incrementador +1 */}
      <rect x={40} y={175} width={70} height={30} rx={1} fill="var(--hoja)" stroke={sig.pcInc ? ON : "var(--linea-fuerte)"} strokeWidth={sig.pcInc ? 1.8 : 1.2} />
      <SvgText x={75} y={195} s={11} f={sig.pcInc ? ON : "var(--tinta-2)"} b>+1</SvgText>

      {/* MUX de origen del PC: 0 = PC+1 (incrementador) · 1 = inmediato (salto) */}
      <polygon points="62,24 98,24 90,55 70,55" fill="var(--hoja)" stroke={pcActive ? ON : "var(--linea-fuerte)"} strokeWidth={pcActive ? 1.6 : 1.2} />
      <SvgText x={80} y={46} s={6.5} f={pcActive ? ON : "var(--tinta-2)"} b>MUX</SvgText>
      <SvgText x={101} y={45} s={6.5} f={sig.pcInc ? ON : "var(--tinta-2)"} a="start">0:+1</SvgText>
      <SvgText x={86} y={20} s={6.5} f={sig.pcLoad ? ON : "var(--tinta-2)"} a="start">1:imm</SvgText>

      {/* RAM */}
      <rect x={240} y={30} width={185} height={115} rx={1} fill="var(--hoja)" stroke={sig.memRead ? CYAN : "var(--linea-fuerte)"} strokeWidth={sig.memRead ? 1.8 : 1.2} />
      <SvgText x={332} y={48} s={9.5} f="var(--tinta)" b>RAM 256×8</SvgText>
      <SvgText x={258} y={80} s={11} f={CYAN} a="start">{`A=0x${h2(sig.addrBus)}`}</SvgText>
      <SvgText x={258} y={102} s={11} f={CYAN} a="start">{`D=0x${h2(sig.ramOut)}`}</SvgText>
      <SvgText x={412} y={128} s={7} f="var(--tinta-2)" a="end">dir ← PC</SvgText>
      <SvgText x={412} y={139} s={7} f="var(--tinta-2)" a="end">dato → IR / imm</SvgText>

      {/* IR */}
      <rect x={530} y={55} width={120} height={70} rx={1} fill="var(--hoja)" stroke={sig.irWrite ? CYAN : "var(--linea-fuerte)"} strokeWidth={sig.irWrite ? 1.8 : 1.2} />
      <SvgText x={590} y={74} s={9.5} f="var(--tinta)" b>IR</SvgText>
      <SvgText x={590} y={99} s={15} f={CYAN} b>{state.irValid ? `0x${h2(state.ir)}` : "—"}</SvgText>
      <SvgText x={590} y={117} s={8} f="var(--tinta-2)">{state.irValid ? decodeByte(state.ir) : "sin fetch"}</SvgText>

      {/* Unidad de Control */}
      <rect x={490} y={200} width={185} height={115} rx={1} fill="var(--hoja)" stroke="var(--tinta)" strokeWidth={1.5} />
      <SvgText x={582} y={220} s={9.5} f="var(--tinta)" b>Unidad de control</SvgText>
      <SvgText x={582} y={236} s={7} f="var(--tinta-2)">decodifica IR[7:4] → señales</SvgText>
      <SvgText x={582} y={258} s={11} f="var(--tinta)" b>{state.lastInstruction}</SvgText>
      <SvgText x={582} y={276} s={8} f="var(--tinta-2)">{`OP=0x${h2((state.ir >> 4) & 0xf)}h · ciclo #${state.cycleCount}`}</SvgText>
      <SvgText x={582} y={297} s={7} f="var(--tinta-2)">→ señales de control (izq.)</SvgText>

      {/* Banco de registros */}
      <rect x={25} y={250} width={145} height={235} rx={1} fill="var(--hoja)" stroke={sig.regWrite ? ON : readReg >= 0 ? CYAN : "var(--linea-fuerte)"} strokeWidth={1.2} />
      <SvgText x={97} y={266} s={9.5} f="var(--tinta)" b>Banco de Registros</SvgText>
      <SvgText x={97} y={278} s={6.5} f="var(--tinta-2)">2 lecturas, 1 escritura</SvgText>
      {state.regs.map((v, i) => {
        const isW = i === writeReg;
        const isR = i === readReg;
        return (
          <g key={i}>
            <rect
              x={38}
              y={285 + i * 24}
              width={118}
              height={20}
              rx={1}
              fill={isW ? "var(--sel-suave)" : isR ? "var(--sel-suave)" : "var(--papel)"}
              stroke={isW ? ON : isR ? CYAN : "var(--linea-fuerte)"}
              strokeWidth={isW || isR ? 1.5 : 1}
            />
            <SvgText x={48} y={299 + i * 24} s={9} f="var(--tinta)" a="start">{`R${i}`}</SvgText>
            <SvgText x={148} y={299 + i * 24} s={9} f={isW ? ON : "var(--tinta)"} a="end">{`0x${h2(v)}`}</SvgText>
          </g>
        );
      })}
      <SvgText x={176} y={303} s={7.5} f={REG_ALU_OPS.has(sig.aluOp) ? ON : "var(--tinta-2)"} a="start">A</SvgText>
      <SvgText x={176} y={373} s={7.5} f={sig.muxSel === "reg" ? ON : "var(--tinta-2)"} a="start">B</SvgText>
      <SvgText x={18} y={471} s={7.5} f={sig.regWrite ? ON : "var(--tinta-2)"} a="start">W</SvgText>

      {/* ALU */}
      <polygon points="250,330 400,355 400,425 250,450" fill="var(--hoja)" stroke={aluOn ? ON : "var(--linea-fuerte)"} strokeWidth={aluOn ? 1.8 : 1.2} />
      <SvgText x={325} y={390} s={15} f={aluOn ? ON : "var(--tinta-2)"} b>{aluOn ? sig.aluOp : "ALU"}</SvgText>
      {flags.map(([name, val], i) => (
        <SvgText key={name} x={272 + i * 26} y={415} s={8} f={val === 1 ? ON : "var(--tinta-2)"}>
          {`${name}=${val}`}
        </SvgText>
      ))}
      <SvgText x={244} y={358} s={7.5} f="var(--tinta-2)" a="end">A</SvgText>
      <SvgText x={244} y={428} s={7.5} f={aluOn ? ON : "var(--tinta-2)"} a="end">B</SvgText>
      <SvgText x={408} y={393} s={7.5} f={aluOn ? ON : "var(--tinta-2)"} a="start">Y</SvgText>

      {/* MUX */}
      <polygon points="470,340 540,365 540,410 470,435" fill="var(--hoja)" stroke={sig.muxSel !== "" ? ON : "var(--linea-fuerte)"} strokeWidth={sig.muxSel !== "" ? 1.8 : 1.2} />
      <SvgText x={502} y={368} s={9} f="var(--tinta-2)" b>MUX</SvgText>
      <SvgText x={502} y={386} s={7} f={sig.muxSel !== "" ? ON : "var(--tinta-2)"}>{muxLabel}</SvgText>
      <SvgText x={464} y={358} s={7} f={sig.muxSel === "alu" ? ON : "var(--tinta-2)"} a="end">0</SvgText>
      <SvgText x={464} y={391} s={7} f={sig.muxSel === "imm" ? ON : "var(--tinta-2)"} a="end">1</SvgText>
      <SvgText x={464} y={424} s={7} f={sig.muxSel === "reg" ? ON : "var(--tinta-2)"} a="end">2</SvgText>

      {/* Acumulador */}
      <rect x={575} y={355} width={95} height={68} rx={1} fill="var(--hoja)" stroke={sig.accWrite ? ON : "var(--linea-fuerte)"} strokeWidth={sig.accWrite ? 1.8 : 1.2} />
      <SvgText x={622} y={375} s={9.5} f="var(--tinta)" b>ACC</SvgText>
      <SvgText x={622} y={401} s={16} f={sig.accWrite ? ON : CYAN} b>{`0x${h2(state.acc)}`}</SvgText>

      {/* leyenda */}
      <circle cx={30} cy={537} r={3} fill={ON} />
      <SvgText x={38} y={540} s={8} f="var(--tinta-2)" a="start">señal activa</SvgText>
      <circle cx={132} cy={537} r={3} fill={CYAN} />
      <SvgText x={140} y={540} s={8} f="var(--tinta-2)" a="start">datos</SvgText>
      <circle cx={205} cy={537} r={3} fill={OFF} />
      <SvgText x={213} y={540} s={8} f="var(--tinta-2)" a="start">inactivo</SvgText>
      <SvgText x={25} y={557} s={8} f="var(--tinta-2)" a="start">1 step = 1 ciclo completo fetch → decode → execute · modelo didáctico de cátedra</SvgText>
    </svg>
  );
}

/* ---------- panel principal ---------- */

export function ProcessorPanel() {
  // instancia estable del motor (se muta imperativamente + tick para re-render)
  // el preset inicial se ensambla una sola vez, en el inicializador
  const [init] = useState(() => {
    const p = new Processor();
    const r = p.loadProgram(PRESETS[0]?.code ?? "");
    return { proc: p, bytes: r.bytes, errors: r.errors };
  });
  const proc = init.proc;

  const pushLog = useCircuit((s) => s.pushLog);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const [presetId, setPresetId] = useState(PRESETS[0]?.id ?? "suma");
  const [asm, setAsm] = useState(PRESETS[0]?.code ?? "");
  const [asmErrors, setAsmErrors] = useState<AsmError[]>(init.errors);
  const [asmBytes, setAsmBytes] = useState(init.bytes);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState("3");
  const [tempoOpen, setTempoOpen] = useState(false);

  // auto-ejecución
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (proc.state.halted) {
        setRunning(false);
        refresh();
        return;
      }
      proc.step();
      if (proc.state.halted) {
        setRunning(false);
        pushLog("info", "Procesador: HALT — ejecución detenida.");
      }
      refresh();
    }, 1000 / Number(speed));
    return () => clearInterval(id);
  }, [running, speed, refresh, pushLog, proc]);

  const handleAssemble = useCallback(() => {
    const r = proc.loadProgram(asm);
    setAsmErrors(r.errors);
    if (r.ok) {
      setAsmBytes(r.bytes);
      setRunning(false);
      pushLog("success", `Procesador: programa ensamblado → ${r.bytes} bytes en RAM`);
    } else {
      pushLog("error", `Procesador: ${r.errors.length} error(es) de ensamblado`);
    }
    refresh();
  }, [asm, proc, pushLog, refresh]);

  const applyPreset = useCallback(
    (id: string) => {
      const p = PRESETS.find((x) => x.id === id);
      if (!p) return;
      setPresetId(id);
      setAsm(p.code);
      const r = proc.loadProgram(p.code);
      setAsmErrors(r.errors);
      if (r.ok) {
        setAsmBytes(r.bytes);
        setRunning(false);
      }
      refresh();
    },
    [proc, refresh],
  );

  const handleStep = useCallback(() => {
    proc.step();
    if (proc.state.halted) {
      setRunning(false);
      pushLog("info", "Procesador: HALT — ejecución detenida.");
    }
    refresh();
  }, [proc, pushLog, refresh]);

  const handleReset = useCallback(() => {
    proc.reset();
    setRunning(false);
    refresh();
  }, [proc, refresh]);

  const handleRamEdit = useCallback(
    (addr: number, value: number) => {
      proc.setRam(addr, value);
      refresh();
    },
    [proc, refresh],
  );

  const state = proc.state;
  const sig = proc.getSignals();
  const ranCycle = sig.irWrite; // hubo al menos un ciclo fetch-decode-execute
  const phaseCls = ranCycle
    ? "border-tinta bg-tinta text-papel"
    : "border-linea bg-hoja-2 text-tinta-2";

  return (
    <div className="flex h-full w-full gap-3 overflow-x-auto bg-papel p-3">
      {/* ============ columna izquierda: assembler + RAM ============ */}
      <aside aria-label="Programa y memoria" className="flex min-h-0 w-[19rem] flex-none flex-col gap-2">
        <div className="flex flex-none items-center gap-1.5">
          <Select value={presetId} onValueChange={applyPreset}>
            <SelectTrigger aria-label="Programa de ejemplo" className="h-7 flex-1 border-linea bg-hoja-2 text-[12px] text-tinta">
              <SelectValue placeholder="Programas" />
            </SelectTrigger>
            <SelectContent className="border-linea bg-hoja-2 text-tinta">
              {PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAssemble}
            className="h-7 flex-none px-2 text-[12px] border border-tinta bg-tinta text-papel hover:bg-transparent hover:text-tinta"
          >
            Ensamblar
          </Button>
        </div>

        <textarea
          value={asm}
          onChange={(e) => setAsm(e.target.value)}
          spellCheck={false}
          aria-label="Editor de assembler"
          className="h-32 w-full flex-none resize-none rounded border border-linea bg-hoja-2 p-2 font-mono text-[11px] leading-[1.5] text-tinta outline-none focus:border-sel"
        />

        {asmErrors.length > 0 ? (
          <div className="max-h-20 flex-none overflow-y-auto rounded border border-fallo bg-fallo/15 p-1.5">
            {asmErrors.map((e: AsmError, i: number) => (
              <div key={i} className="font-mono text-[12px] leading-4 text-fallo">
                {`Línea ${e.line}: ${e.msg}`}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-none rounded border border-linea bg-hoja-2/60 px-2 py-1 text-[12px] text-tinta-2">
            Assembler OK · etiquetas <code className="text-tinta-2">name:</code>, comentarios{" "}
            <code className="text-tinta-2">;</code> o <code className="text-tinta-2">#</code>
            {asmBytes > 0 ? <span className="ml-1 text-tinta">{asmBytes} bytes en RAM</span> : null}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col rounded border border-linea bg-hoja-2 p-1.5">
          <div className="mb-1 flex flex-none items-center justify-between px-0.5">
            <span className="text-[12px] font-semibold text-tinta-2">
              RAM 256×8 <span className="font-normal text-tinta-2">(hex editable)</span>
            </span>
            <span className="font-mono text-[12px] text-tinta">{`PC=0x${h2(state.pc)}`}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            <RamGrid ram={state.ram} pc={state.pc} progLen={state.progLen} onEdit={handleRamEdit} />
          </div>
        </div>
      </aside>

      {/* ============ centro: datapath SVG ============ */}
      <section className="flex min-h-0 min-w-[420px] flex-1 flex-col gap-1.5">
        <div className="flex flex-none flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`h-5 px-2 text-[12px] ${phaseCls}`}>
            Fetch
          </Badge>
          <Badge variant="outline" className={`h-5 px-2 text-[12px] ${phaseCls}`}>
            Decode
          </Badge>
          <Badge variant="outline" className={`h-5 px-2 text-[12px] ${phaseCls}`}>
            Execute
          </Badge>
          {state.halted ? (
            <Badge className="h-5 border border-fallo bg-fallo/15 px-2 text-[12px] text-fallo">
              HALT
            </Badge>
          ) : null}
          <span className="ml-auto font-mono text-[12px] text-tinta-2">
            {`ciclo n.º ${state.cycleCount} · ${state.lastInstruction}`}
          </span>
        </div>
        <div className="min-h-0 flex-1 rounded-sm border border-linea bg-hoja p-1">
          <DatapathSvg state={state} sig={sig} />
        </div>
      </section>

      {/* ============ columna derecha: controles + log + análisis + FAQ ============ */}
      <aside aria-label="Ejecución" className="flex min-h-0 w-72 flex-none flex-col gap-2">
        {/* controles */}
        <div className="flex-none rounded-sm border border-linea bg-hoja-2 p-2">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => setRunning((r) => !r)}
              disabled={state.halted}
              className="h-8 flex-1 gap-1 text-[12px] border border-tinta bg-tinta text-papel hover:bg-transparent hover:text-tinta"
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pausar" : "Ejecutar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStep}
              disabled={state.halted || running}
              className="h-8 gap-1 border-linea bg-hoja-2 text-[11px] text-tinta hover:bg-hoja-2"
            >
              <StepForward className="h-3.5 w-3.5" />
              Paso
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="h-8 gap-1 border-linea bg-hoja-2 text-[11px] text-tinta hover:bg-hoja-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-none text-[12px] text-tinta-2">Velocidad</span>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger aria-label="Velocidad" className="h-7 flex-1 border-linea bg-hoja-2 text-[12px] text-tinta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-linea bg-hoja-2 text-tinta">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-[11px]">
                    {`${n} ciclos/s`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.halted ? (
              <Badge className="h-5 flex-none border border-fallo bg-fallo/15 px-2 text-[12px] text-fallo">
                HALT
              </Badge>
            ) : running ? (
              <Badge className="h-5 flex-none border border-linea-fuerte bg-transparent px-2 text-[12px] text-tinta">
                ▶ auto
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 flex-none border-linea px-2 text-[12px] text-tinta-2">
                listo
              </Badge>
            )}
          </div>
        </div>

        {/* registro de ciclos */}
        <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-linea bg-hoja-2 p-2">
          <div className="mb-1 flex flex-none items-center justify-between">
            <span className="text-[11px] font-semibold text-tinta">Registro de ciclos</span>
            <span className="font-mono text-[12px] text-tinta-2">{`# ${state.cycleCount}`}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded bg-hoja-2 p-1.5">
            {state.log.length === 0 ? (
              <div className="text-[12px] text-tinta-2">Sin ciclos ejecutados todavía…</div>
            ) : (
              state.log.map((l, i) => (
                <div
                  key={i}
                  className={`whitespace-pre font-mono text-[12px] leading-4 ${
                    i === 0 ? "text-alto" : "text-tinta-2"
                  }`}
                >
                  {l}
                </div>
              ))
            )}
          </div>
        </div>

        {/* análisis temporal */}
        <Collapsible open={tempoOpen} onOpenChange={setTempoOpen} className="flex-none rounded-sm border border-linea bg-hoja-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-left">
            <span className="text-[11px] font-semibold text-tinta">Análisis temporal</span>
            <ChevronDown className={`h-3.5 w-3.5 flex-none text-tinta-2 transition-transform ${tempoOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-[2px] rounded bg-hoja-2 p-1.5 font-mono text-[12px] leading-4 text-tinta-2">
              {REF_DELAYS.map((d) => (
                <div key={d.name} className="flex justify-between gap-2">
                  <span className="text-tinta-2">{d.name}</span>
                  <span>{`${d.ns} ns`}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 rounded border border-linea-fuerte p-1.5 font-mono text-[12px] leading-4 text-tinta">
              <div>Camino crítico (1 ciclo = fetch → decode → execute):</div>
              <div>T_min = t_ram + t_IR + t_CU + t_MUX + t_ALU + t_setup + t_prop</div>
              <div>
                {`= ${TIMING_TERMS.map((t) => t.value).join(" + ")} = `}
                <b>{`${T_MIN_NS} ns`}</b>
              </div>
              <div>
                {`f_max = 1/T_min ≈ `}
                <b>{`${F_MAX_MHZ.toFixed(1)} MHz`}</b>
              </div>
            </div>
            <p className="mt-1 text-[11px] leading-[1.4] text-tinta-2">
              t_IR ≈ t_buffers + t_setup = 1.25 ns (escritura del PIPO de instrucción). Peor caso de ALU: ADD/SUB
              (5 ns); shifts 0.5 ns. t_hold = 0.01 ns sin violaciones. El camino crítico atraviesa fetch → decode →
              execute dentro de un único período de reloj.
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* FAQ del final */}
        <div className="max-h-[30vh] flex-none overflow-y-auto rounded-sm border border-linea bg-hoja-2">
          <Accordion type="single" collapsible className="px-2">
            <AccordionItem value="faq1" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Combinacional o secuencial?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                Combinacionales: la salida depende solo de las entradas del instante — ALU, decodificador de la CU,
                MUX/DMUX, lectura de RAM. Secuenciales: almacenan estado y se actualizan con el reloj — PC, IR, banco
                de registros, Acumulador y los FF de flags ZCVN.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq2" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Qué se puede implementar con latches?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                Banco de registros: en principio sí (latches D sin realimentación, aceptando transparencia durante el
                nivel de reloj). Acumulador: NO — se realimenta con la ALU, un latch transparente provocaría carreras.
                PC: NO — el incremento realimentado exige FF por flanco. IR: depende — la RAM es estable durante el
                ciclo, así que un latch podría bastar, pero el FF es más robusto.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq3" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Se puede implementar en FPGA con Slices?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                Sí: cada Slice aporta LUTs (lógica combinacional de la CU y la ALU) y FFs (PC, IR, Acc, registros,
                flags). La RAM 256×8 se mapea a LUTRAM/BRAM. Entra sin problema en una FPGA chica, según recursos
                disponibles.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq4" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Cuántas funciones booleanas tiene la CU?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                Una por cada señal de control: pcLoad, pcInc, irWrite, memRead, memWrite, regWrite, accWrite, muxSel y
                el selector de operación de la ALU. Cada una es una función combinacional del opcode (y del flag Z para
                JZ).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq5" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Por qué el PC debe ser FF y no latch?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                Por la transparencia del latch: mientras el reloj está en nivel activo, el +1 realimentado se
                propagaría varias veces dentro del mismo ciclo. El FF disparado por flanco garantiza un único
                incremento por ciclo de reloj.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq6" className="border-linea">
              <AccordionTrigger className="py-1.5 text-[11px] text-tinta hover:no-underline">
                ¿Qué pasa sin IR?
              </AccordionTrigger>
              <AccordionContent className="text-[12px] leading-4 text-tinta-2">
                El byte de la RAM entraría directo a la CU combinacional: el camino crítico se alarga (t_ram + t_cu +
                t_alu sin registro intermedio), f_max cae, y la instrucción «viva» en el bus cambiaría a mitad del
                ciclo si el contenido de la RAM cambia.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </aside>
    </div>
  );
}
