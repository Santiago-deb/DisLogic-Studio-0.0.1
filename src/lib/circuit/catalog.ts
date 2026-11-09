// ============================================================
// DisLogic — Catálogo de componentes
// Definiciones, pines, evaluación y tablas de verdad
// ============================================================
import type {
  ComponentDef,
  ComponentType,
  EvalContext,
  PinDef,
  SignalValue,
  TruthTable,
} from "./types";

const n = (v: SignalValue): number => (v === undefined ? 0 : v);
const undef = (v: SignalValue): boolean => v === undefined;

/** bits requeridos para representar un número */
export const bitsOf = (cells: number): number => Math.max(1, Math.ceil(Math.log2(Math.max(2, cells))));

/** pines de entrada i0..in(n-1) */
const inPins = (count: number, prefix = "in"): PinDef[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix === "in" ? "" : prefix.toUpperCase()}${i}`, direction: "input" as const, width: 1 }));

const outPins = (count: number, prefix = "out"): PinDef[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix.toUpperCase()}${i}`, direction: "output" as const, width: 1 }));

const busIn = (id: string, name: string, wFn: (p: Record<string, unknown>) => number): PinDef => ({
  id,
  name,
  direction: "input",
  width: wFn,
});
const busOut = (id: string, name: string, wFn: (p: Record<string, unknown>) => number): PinDef => ({
  id,
  name,
  direction: "output",
  width: wFn,
});

const W = (p: Record<string, unknown>): number => (p.bits as number) ?? 8;
const SEL = (p: Record<string, unknown>): number => (p.nSel as number) ?? 1;

/** compuerta genérica de N entradas con opcional inversión de entradas */
function gateEval(op: "AND" | "OR" | "XOR", negateOutput: boolean) {
  return (ctx: EvalContext) => {
    const neg = (ctx.props.negInputs as boolean[] | undefined) ?? [];
    const vals = Object.keys(ctx.inputs)
      .sort()
      .map((k, i) => {
        const v = n(ctx.inputs[k]);
        return neg[i] ? (v ? 0 : 1) : v;
      });
    let out: number;
    if (op === "AND") out = vals.every((v) => v === 1) ? 1 : 0;
    else if (op === "OR") out = vals.some((v) => v === 1) ? 1 : 0;
    else out = vals.reduce((a, b) => a ^ b, 0);
    if (negateOutput) out = out ? 0 : 1;
    ctx.outputs["out"] = out;
  };
}

const gatePins = (props: Record<string, unknown>): PinDef[] => {
  const count = (props.nIn as number) ?? 2;
  return inPins(count).concat([{ id: "out", name: "out", direction: "output", width: 1 }]);
};

const negField = {
  kind: "toggle" as const,
  key: "negInputs",
  label: "Negar entradas (burbujas)",
};

const DELAYS: Record<string, number> = {
  AND: 2, OR: 3, NOT: 1, NAND: 2, NOR: 2, XOR: 4, XNOR: 4, BUFFER: 1,
};

const delayField = (dflt: number) => ({
  kind: "number" as const,
  key: "delay",
  label: "Retardo",
  min: 0,
  max: 50,
  step: 0.5,
  suffix: "ns",
  ...{ default: dflt },
});

function gateTruth(name: string, nIn: number, op: (v: number[]) => number): TruthTable {
  const rows: string[][] = [];
  const total = 1 << nIn;
  for (let m = 0; m < total; m++) {
    const vals = Array.from({ length: nIn }, (_, i) => (m >> (nIn - 1 - i)) & 1);
    rows.push([...vals.map(String), String(op(vals))]);
  }
  return { headers: [...Array.from({ length: nIn }, (_, i) => String.fromCharCode(65 + i)), "S"], rows };
}

const andOp = (v: number[]) => (v.every((x) => x === 1) ? 1 : 0);
const orOp = (v: number[]) => (v.some((x) => x === 1) ? 1 : 0);
const xorOp = (v: number[]) => v.reduce((a, b) => a ^ b, 0);

function multiGateDef(
  type: ComponentType,
  label: string,
  short: string,
  op: "AND" | "OR" | "XOR",
  negOut: boolean,
  desc: string,
): ComponentDef {
  return {
    type,
    label,
    short,
    category: "gates",
    description: desc,
    defaults: { nIn: 2, delay: DELAYS[type as string] ?? 2, negInputs: [] },
    propFields: [
      { kind: "select", key: "nIn", label: "Entradas", options: [2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: `${v}` })) },
      delayField(DELAYS[type as string] ?? 2),
      negField,
    ],
    pins: gatePins,
    eval: gateEval(op, negOut),
    truthTable: (p) => gateTruth(label, (p.nIn as number) ?? 2, op === "AND" ? andOp : op === "OR" ? orOp : xorOp),
    equation: () => null,
  };
}

// ============================================================
// CATÁLOGO
// ============================================================
export const CATALOG: Record<ComponentType, ComponentDef> = {
  // ------------------------------------------------ GATES
  AND: multiGateDef("AND", "AND", "AND", "AND", false, "Compuerta AND: la salida es 1 solo si TODAS las entradas son 1. S = A·B"),
  OR: multiGateDef("OR", "OR", "OR", "OR", false, "Compuerta OR: la salida es 1 si ALGUNA entrada es 1. S = A+B"),
  NOT: {
    type: "NOT",
    label: "NOT (Inversor)",
    short: "1",
    category: "gates",
    description: "Inversor: S = A'. Triángulo con burbuja (estándar IEEE/ANSI).",
    defaults: { delay: 1 },
    propFields: [delayField(1)],
    pins: [inPins(1)[0], { id: "out", name: "out", direction: "output", width: 1 }],
    eval: (ctx) => {
      ctx.outputs["out"] = n(ctx.inputs["in0"]) ? 0 : 1;
    },
    truthTable: () => gateTruth("NOT", 1, (v) => (v[0] ? 0 : 1)),
  },
  NAND: multiGateDef("NAND", "NAND", "NAND", "AND", true, "AND negada: S = (A·B)'. Universal: permite implementar cualquier función."),
  NOR: multiGateDef("NOR", "NOR", "NOR", "OR", true, "OR negada: S = (A+B)'. Universal: permite implementar cualquier función."),
  XOR: multiGateDef("XOR", "XOR", "XOR", "XOR", false, "OR exclusiva: S = A⊕B (1 si las entradas difieren). 2 entradas."),
  XNOR: multiGateDef("XNOR", "XNOR (Equivalencia)", "XNOR", "XOR", true, "XOR negada: S = (A⊕B)' (1 si las entradas son iguales). 2 entradas."),
  BUFFER: {
    type: "BUFFER",
    label: "Buffer",
    short: "▷",
    category: "gates",
    description: "Seguidor: S = A. Usado para regenerar señales.",
    defaults: { delay: 1 },
    propFields: [delayField(1)],
    pins: [inPins(1)[0], { id: "out", name: "out", direction: "output", width: 1 }],
    eval: (ctx) => {
      ctx.outputs["out"] = n(ctx.inputs["in0"]);
    },
  },
  TRI_STATE_BUFFER: {
    type: "TRI_STATE_BUFFER",
    label: "Buffer Tri-estado",
    short: "△",
    category: "gates",
    description: "Buffer con enable: si EN=1 la salida sigue la entrada; si EN=0 la salida queda en alta impedancia (flotante). Base de los buses compartidos.",
    defaults: { delay: 1 },
    propFields: [delayField(1)],
    pins: [inPins(1, "d")[0], { id: "en", name: "EN", direction: "input", width: 1 }, { id: "out", name: "out", direction: "output", width: 1 }],
    eval: (ctx) => {
      ctx.outputs["out"] = n(ctx.inputs["en"]) === 1 ? n(ctx.inputs["d0"]) : undefined;
      if (n(ctx.inputs["en"]) === 0 && ctx.inputs["d0"] !== undefined && false) ctx.outputs["out"] = undefined;
    },
  },

  // ------------------------------------------------ WIRING
  INPUT_PIN: {
    type: "INPUT_PIN",
    label: "Pin de Entrada",
    short: "IN",
    category: "wiring",
    description: "Interruptor toggle 0/1. En modo simulación, hacé clic para alternar su valor.",
    defaults: { value: 0 },
    propFields: [{ kind: "toggle", key: "_clickHint", label: "Clic en simulación para alternar" }],
    pins: [{ id: "out", name: "Q", direction: "output", width: 1 }],
    clickable: true,
    initState: () => ({ value: 0 }),
    eval: (ctx) => {
      ctx.outputs["out"] = (ctx.state.value as number) ?? (ctx.props.value as number) ?? 0;
    },
  },
  OUTPUT_PIN: {
    type: "OUTPUT_PIN",
    label: "Pin de Salida (LED)",
    short: "OUT",
    category: "wiring",
    description: "LED indicador: verde = 1, rojo = 0.",
    defaults: {},
    pins: [{ id: "in0", name: "A", direction: "input", width: 1 }],
    eval: (ctx) => {},
  },
  CLOCK: {
    type: "CLOCK",
    label: "Reloj (Clock)",
    short: "CLK",
    category: "wiring",
    description: "Genera una onda cuadrada periódica. En modo ideal se controla con Play/Step; en modo temporal usa su período en ns.",
    defaults: { periodNs: 100 },
    propFields: [{ kind: "number", key: "periodNs", label: "Período (modo temporal)", min: 10, max: 10000, step: 10, suffix: "ns" }],
    pins: [{ id: "out", name: "CLK", direction: "output", width: 1 }],
    clickable: true,
    initState: () => ({ level: 0 }),
    eval: (ctx) => {
      ctx.outputs["out"] = (ctx.state.level as number) ?? 0;
    },
  },
  CONSTANT: {
    type: "CONSTANT",
    label: "Constante",
    short: "K",
    category: "wiring",
    description: "Emite un valor fijo de N bits.",
    defaults: { bits: 1, value: 1 },
    propFields: [
      { kind: "select", key: "bits", label: "Ancho", options: [1, 2, 3, 4, 8].map((v) => ({ value: v, label: `${v} bit${v > 1 ? "s" : ""}` })) },
      { kind: "bits", key: "value", label: "Valor" },
    ],
    pins: [busOut("out", "K", W)],
    eval: (ctx) => {
      ctx.outputs["out"] = (ctx.props.value as number) ?? 0;
    },
  },
  POWER: {
    type: "POWER",
    label: "Power (VCC)",
    short: "VCC",
    category: "wiring",
    description: "Nodo de alimentación: emite 1 lógico permanente.",
    defaults: {},
    pins: [{ id: "out", name: "1", direction: "output", width: 1 }],
    eval: (ctx) => {
      ctx.outputs["out"] = 1;
    },
  },
  GROUND: {
    type: "GROUND",
    label: "Ground (GND)",
    short: "GND",
    category: "wiring",
    description: "Nodo de tierra: emite 0 lógico permanente.",
    defaults: {},
    pins: [{ id: "out", name: "0", direction: "output", width: 1 }],
    eval: (ctx) => {
      ctx.outputs["out"] = 0;
    },
  },
  PROBE: {
    type: "PROBE",
    label: "Sonda (Probe)",
    short: "⌕",
    category: "wiring",
    description: "Muestra en tiempo real el valor del cable conectado (bin/dec/hex según el ancho).",
    defaults: { format: "dec" },
    propFields: [
      { kind: "select", key: "format", label: "Formato", options: [
        { value: "bin", label: "Binario" },
        { value: "dec", label: "Decimal" },
        { value: "hex", label: "Hexadecimal" },
      ] },
    ],
    pins: [{ id: "in0", name: "A", direction: "input", width: (p) => (p.probeWidth as number) ?? 8 }],
    eval: (ctx) => {},
  },
  TUNNEL: {
    type: "TUNNEL",
    label: "Túnel / Etiqueta",
    short: "⊙",
    category: "wiring",
    description: "Conecta señales a distancia usando un nombre: todos los túneles con la misma etiqueta comparten la señal.",
    defaults: { label: "A" },
    propFields: [{ kind: "text", key: "label", label: "Etiqueta" }],
    pins: [{ id: "in0", name: "in", direction: "input", width: 1 }, { id: "out", name: "out", direction: "output", width: 1 }],
    eval: (ctx) => {},
  },
  SPLITTER: {
    type: "SPLITTER",
    label: "Splitter (Bus→bits)",
    short: "⇒|",
    category: "wiring",
    description: "Divide un bus de N bits en señales individuales B0 (LSB) … B(N-1) (MSB).",
    defaults: { bits: 4 },
    propFields: [{ kind: "select", key: "bits", label: "Ancho del bus", options: [2, 3, 4, 8].map((v) => ({ value: v, label: `${v}` })) }],
    pins: (p) => [busIn("bus", "BUS", W), ...Array.from({ length: W(p) }, (_, i) => ({ id: `b${i}`, name: `B${i}`, direction: "output" as const, width: 1 }))],
    eval: (ctx) => {
      const w = W(ctx.props);
      const v = n(ctx.inputs["bus"]);
      for (let i = 0; i < w; i++) ctx.outputs[`b${i}`] = (v >> i) & 1;
    },
  },
  COMBINER: {
    type: "COMBINER",
    label: "Combiner (bits→Bus)",
    short: "|⇒",
    category: "wiring",
    description: "Combina señales individuales B0 (LSB) … B(N-1) (MSB) en un bus de N bits.",
    defaults: { bits: 4 },
    propFields: [{ kind: "select", key: "bits", label: "Ancho del bus", options: [2, 3, 4, 8].map((v) => ({ value: v, label: `${v}` })) }],
    pins: (p) => [...Array.from({ length: W(p) }, (_, i) => ({ id: `b${i}`, name: `B${i}`, direction: "input" as const, width: 1 })), busOut("bus", "BUS", W)],
    eval: (ctx) => {
      const w = W(ctx.props);
      let v = 0;
      for (let i = 0; i < w; i++) v |= n(ctx.inputs[`b${i}`]) << i;
      ctx.outputs["bus"] = v;
    },
  },

  // ------------------------------------------------ PLEXERS
  MUX: {
    type: "MUX",
    label: "Multiplexor (MUX)",
    short: "MUX",
    category: "plexers",
    description: "Selecciona una de las 2^n entradas de datos según el selector y la lleva a la salida. Ecuación: S = Σ (mᵢ · sel=i).",
    defaults: { nSel: 1, bits: 1, delay: 2 },
    propFields: [
      { kind: "select", key: "nSel", label: "Bits de selección", options: [1, 2, 3, 4].map((v) => ({ value: v, label: `MUX ${1 << v}:1` })) },
      { kind: "select", key: "bits", label: "Ancho de datos", options: [1, 2, 4, 8].map((v) => ({ value: v, label: `${v} bit${v > 1 ? "s" : ""}` })) },
      delayField(2),
    ],
    pins: (p) => {
      const dataCount = 1 << SEL(p);
      return [
        ...Array.from({ length: dataCount }, (_, i) => busIn(`d${i}`, `I${i}`, W)),
        ...Array.from({ length: SEL(p) }, (_, i) => ({ id: `s${i}`, name: `S${i}`, direction: "input" as const, width: 1 })),
        busOut("out", "S", W),
      ];
    },
    eval: (ctx) => {
      let sel = 0;
      for (let i = 0; i < SEL(ctx.props); i++) sel |= n(ctx.inputs[`s${i}`]) << i;
      ctx.outputs["out"] = ctx.inputs[`d${sel}`];
    },
    truthTable: (p) => {
      const k = SEL(p);
      const rows: string[][] = [];
      for (let s = 0; s < 1 << k; s++) {
        const sBits = Array.from({ length: k }, (_, i) => ((s >> (k - 1 - i)) & 1).toString());
        rows.push([...sBits, `I${s}`, `I${s}`]);
      }
      return { headers: [...Array.from({ length: k }, (_, i) => `S${k - 1 - i}`), "Datos", "Salida"], rows, note: "MUX 2^n:1 — el selector elige qué entrada pasa a la salida." };
    },
  },
  DMUX: {
    type: "DMUX",
    label: "Demultiplexor (DMUX)",
    short: "DMUX",
    category: "plexers",
    description: "Dirige la entrada de datos a UNA de las 2^n salidas según el selector; las demás salen 0.",
    defaults: { nSel: 1, bits: 1, delay: 2 },
    propFields: [
      { kind: "select", key: "nSel", label: "Bits de selección", options: [1, 2, 3].map((v) => ({ value: v, label: `DMUX 1:${1 << v}` })) },
      { kind: "select", key: "bits", label: "Ancho de datos", options: [1, 2, 4, 8].map((v) => ({ value: v, label: `${v} bit${v > 1 ? "s" : ""}` })) },
      delayField(2),
    ],
    pins: (p) => [
      busIn("d", "D", W),
      ...Array.from({ length: SEL(p) }, (_, i) => ({ id: `s${i}`, name: `S${i}`, direction: "input" as const, width: 1 })),
      ...Array.from({ length: 1 << SEL(p) }, (_, i) => busOut(`o${i}`, `O${i}`, W)),
    ],
    eval: (ctx) => {
      let sel = 0;
      for (let i = 0; i < SEL(ctx.props); i++) sel |= n(ctx.inputs[`s${i}`]) << i;
      const d = ctx.inputs["d"];
      const count = 1 << SEL(ctx.props);
      for (let i = 0; i < count; i++) ctx.outputs[`o${i}`] = i === sel ? (d === undefined ? 0 : d) : 0;
    },
    truthTable: (p) => {
      const k = SEL(p);
      const rows: string[][] = [];
      for (let s = 0; s < 1 << k; s++) {
        const sBits = Array.from({ length: k }, (_, i) => ((s >> (k - 1 - i)) & 1).toString());
        const outs = Array.from({ length: 1 << k }, (_, i) => (i === s ? "D" : "0"));
        rows.push([...sBits, ...outs]);
      }
      return { headers: [...Array.from({ length: k }, (_, i) => `S${k - 1 - i}`), ...Array.from({ length: 1 << k }, (_, i) => `O${i}`)], rows };
    },
  },
  DECODER: {
    type: "DECODER",
    label: "Decodificador",
    short: "DEC",
    category: "plexers",
    description: "Activa UNA de las 2^n salidas según el código de entrada (one-hot). Opcionalmente con enable.",
    defaults: { nIn: 2, enable: true, delay: 2 },
    propFields: [
      { kind: "select", key: "nIn", label: "Entradas", options: [
        { value: 2, label: "2 → 4 salidas" },
        { value: 3, label: "3 → 8 salidas" },
        { value: 4, label: "4 → 16 salidas" },
      ] },
      { kind: "toggle", key: "enable", label: "Con pin EN" },
      delayField(2),
    ],
    pins: (p) => {
      const k = (p.nIn as number) ?? 2;
      const pins: PinDef[] = Array.from({ length: k }, (_, i) => ({ id: `a${i}`, name: `A${i}`, direction: "input" as const, width: 1 }));
      if (p.enable) pins.push({ id: "en", name: "EN", direction: "input", width: 1 });
      return pins.concat(Array.from({ length: 1 << k }, (_, i) => ({ id: `o${i}`, name: `O${i}`, direction: "output" as const, width: 1 })));
    },
    eval: (ctx) => {
      const k = (ctx.props.nIn as number) ?? 2;
      let addr = 0;
      for (let i = 0; i < k; i++) addr |= n(ctx.inputs[`a${i}`]) << i;
      const en = ctx.props.enable ? n(ctx.inputs["en"]) : 1;
      for (let i = 0; i < 1 << k; i++) ctx.outputs[`o${i}`] = i === addr && en === 1 ? 1 : 0;
    },
    truthTable: (p) => {
      const k = (p.nIn as number) ?? 2;
      const rows: string[][] = [];
      for (let a = 0; a < 1 << k; a++) {
        const aBits = Array.from({ length: k }, (_, i) => ((a >> (k - 1 - i)) & 1).toString());
        rows.push([...aBits, ...Array.from({ length: 1 << k }, (_, i) => (i === a ? "1" : "0"))]);
      }
      return { headers: [...Array.from({ length: k }, (_, i) => `A${k - 1 - i}`), ...Array.from({ length: 1 << k }, (_, i) => `O${i}`)], rows, note: "Salida one-hot: solo una activa a la vez." };
    },
  },
  ENCODER: {
    type: "ENCODER",
    label: "Codificador Prioritario",
    short: "ENC",
    category: "plexers",
    description: "Codifica la entrada activa de mayor prioridad en binario. V=1 indica que hay alguna entrada activa.",
    defaults: { nIn: 8, delay: 2 },
    propFields: [
      { kind: "select", key: "nIn", label: "Entradas", options: [
        { value: 4, label: "4:2" },
        { value: 8, label: "8:3" },
      ] },
      delayField(2),
    ],
    pins: (p) => {
      const k = (p.nIn as number) ?? 8;
      const ob = bitsOf(k);
      return [
        ...Array.from({ length: k }, (_, i) => ({ id: `i${i}`, name: `I${i}`, direction: "input" as const, width: 1 })),
        ...Array.from({ length: ob }, (_, i) => ({ id: `o${i}`, name: `O${i}`, direction: "output" as const, width: 1 })),
        { id: "v", name: "V", direction: "output" as const, width: 1 },
      ];
    },
    eval: (ctx) => {
      const k = (ctx.props.nIn as number) ?? 8;
      const ob = bitsOf(k);
      let prio = -1;
      for (let i = k - 1; i >= 0; i--) {
        if (n(ctx.inputs[`i${i}`]) === 1) {
          prio = i;
          break;
        }
      }
      for (let b = 0; b < ob; b++) ctx.outputs[`o${b}`] = prio >= 0 ? (prio >> (ob - 1 - b)) & 1 : 0;
      ctx.outputs["v"] = prio >= 0 ? 1 : 0;
    },
  },

  // ------------------------------------------------ ARITMÉTICA
  HALF_ADDER: {
    type: "HALF_ADDER",
    label: "Half Adder (HA)",
    short: "HA",
    category: "arithmetic",
    description: "Semisumador: Sum = A⊕B, Carry = A·B. Suma 2 bits de 1.",
    defaults: {},
    pins: [inPins(2, "a")[0], { id: "b0", name: "B", direction: "input", width: 1 }, { id: "sum", name: "Sum", direction: "output", width: 1 }, { id: "cout", name: "Cout", direction: "output", width: 1 }],
    eval: (ctx) => {
      const a = n(ctx.inputs["a0"]);
      const b = n(ctx.inputs["b0"]);
      ctx.outputs["sum"] = a ^ b;
      ctx.outputs["cout"] = a & b;
    },
    truthTable: () => ({
      headers: ["A", "B", "Sum", "Cout"],
      rows: [
        ["0", "0", "0", "0"],
        ["0", "1", "1", "0"],
        ["1", "0", "1", "0"],
        ["1", "1", "0", "1"],
      ],
      note: "Sum = A⊕B · Cout = A·B",
    }),
  },
  FULL_ADDER: {
    type: "FULL_ADDER",
    label: "Full Adder (FA)",
    short: "Σ",
    category: "arithmetic",
    description: "Sumador completo: Sum = A⊕B⊕Cin, Cout = mayoría(A,B,Cin) = AB + ACin + BCin. Encadenando FAs se arma un sumador ripple de N bits.",
    defaults: {},
    pins: [inPins(2, "a")[0], { id: "b0", name: "B", direction: "input", width: 1 }, { id: "cin", name: "Cin", direction: "input", width: 1 }, { id: "sum", name: "Sum", direction: "output", width: 1 }, { id: "cout", name: "Cout", direction: "output", width: 1 }],
    eval: (ctx) => {
      const a = n(ctx.inputs["a0"]);
      const b = n(ctx.inputs["b0"]);
      const c = n(ctx.inputs["cin"]);
      ctx.outputs["sum"] = a ^ b ^ c;
      ctx.outputs["cout"] = (a & b) | (a & c) | (b & c);
    },
    truthTable: () => {
      const rows: string[][] = [];
      for (let m = 0; m < 8; m++) {
        const a = (m >> 2) & 1, b = (m >> 1) & 1, c = m & 1;
        rows.push([String(a), String(b), String(c), String(a ^ b ^ c), String((a & b) | (a & c) | (b & c))]);
      }
      return { headers: ["A", "B", "Cin", "Sum", "Cout"], rows, note: "Cout = AB + ACin + BCin (función mayoría)" };
    },
  },
  ADDER_N: {
    type: "ADDER_N",
    label: "Sumador N bits (Ripple)",
    short: "Σ+",
    category: "arithmetic",
    description: "Sumador ripple-carry de N bits: N Full Adders en cascada con carry chain. El retardo crece linealmente con N (camino crítico: la cadena de carry).",
    defaults: { bits: 4, delay: 8 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [1, 2, 3, 4, 8, 16, 32, 64].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(8),
    ],
    pins: (p) => [
      busIn("a", "A", W),
      busIn("b", "B", W),
      { id: "cin", name: "Cin", direction: "input", width: 1 },
      busOut("sum", "Sum", W),
      { id: "cout", name: "Cout", direction: "output", width: 1 },
    ],
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = w >= 32 ? 0xffffffff : (1 << w) - 1;
      const a = n(ctx.inputs["a"]) & mask;
      const b = n(ctx.inputs["b"]) & mask;
      const total = a + b + n(ctx.inputs["cin"]);
      ctx.outputs["sum"] = total & mask;
      ctx.outputs["cout"] = w >= 32 ? (total > 0xffffffff ? 1 : 0) : (total >> w) & 1;
    },
  },
  SUBTRACTOR_N: {
    type: "SUBTRACTOR_N",
    label: "Restador N bits",
    short: "Σ−",
    category: "arithmetic",
    description: "Restador por complemento a 2: D = A − B = A + B' + 1. BOUT=1 si A<B sin signo; V=1 si hay overflow con signo.",
    defaults: { bits: 4, delay: 8 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [1, 2, 3, 4, 8, 16].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(8),
    ],
    pins: (p) => [
      busIn("a", "A", W),
      busIn("b", "B", W),
      busOut("d", "D", W),
      { id: "bout", name: "Bout", direction: "output", width: 1 },
      { id: "v", name: "V", direction: "output", width: 1 },
    ],
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = w >= 32 ? 0xffffffff : (1 << w) - 1;
      const signBit = 1 << (w - 1);
      const a = n(ctx.inputs["a"]) & mask;
      const b = n(ctx.inputs["b"]) & mask;
      const d = (a + (~b & mask) + 1) & mask;
      ctx.outputs["d"] = d;
      ctx.outputs["bout"] = a < b ? 1 : 0;
      const aNeg = (a & signBit) !== 0;
      const bNeg = (b & signBit) !== 0;
      const dNeg = (d & signBit) !== 0;
      ctx.outputs["v"] = aNeg !== dNeg && aNeg !== bNeg ? 1 : 0;
    },
  },
  ADDER_SUBTRACTOR: {
    type: "ADDER_SUBTRACTOR",
    label: "Sumador/Restador",
    short: "±Σ",
    category: "arithmetic",
    description: "Circuito combinado: SUB=0 suma (A+B), SUB=1 resta (A−B) usando complemento a 2. Incluye detección de overflow.",
    defaults: { bits: 4, delay: 9 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [2, 3, 4, 8, 16].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(9),
    ],
    pins: (p) => [
      busIn("a", "A", W),
      busIn("b", "B", W),
      { id: "sub", name: "SUB", direction: "input", width: 1 },
      busOut("r", "R", W),
      { id: "cout", name: "Cout", direction: "output", width: 1 },
      { id: "v", name: "V", direction: "output", width: 1 },
    ],
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = w >= 32 ? 0xffffffff : (1 << w) - 1;
      const sub = n(ctx.inputs["sub"]);
      const a = n(ctx.inputs["a"]) & mask;
      let b = n(ctx.inputs["b"]) & mask;
      if (sub) b = (~b) & mask;
      const total = a + b + sub;
      const r = total & mask;
      ctx.outputs["r"] = r;
      ctx.outputs["cout"] = w >= 32 ? (total > 0xffffffff ? 1 : 0) : (total >> w) & 1;
      if (w >= 2) {
        const signBit = 1 << (w - 1);
        const aNeg = (a & signBit) !== 0;
        const bNeg = (b & signBit) !== 0;
        const rNeg = (r & signBit) !== 0;
        ctx.outputs["v"] = sub === 0 ? aNeg && bNeg && !rNeg ? 1 : 0 : aNeg && !bNeg && !rNeg ? 1 : 0;
      } else ctx.outputs["v"] = 0;
    },
  },
  COMPARATOR: {
    type: "COMPARATOR",
    label: "Comparador",
    short: "><=",
    category: "arithmetic",
    description: "Compara dos números de N bits: salidas Mayor (A>B), Igual (A=B) y Menor (A<B).",
    defaults: { bits: 4, delay: 5 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [1, 2, 4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(5),
    ],
    pins: (p) => [
      busIn("a", "A", W),
      busIn("b", "B", W),
      { id: "gt", name: "A>B", direction: "output", width: 1 },
      { id: "eq", name: "A=B", direction: "output", width: 1 },
      { id: "lt", name: "A<B", direction: "output", width: 1 },
    ],
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = w >= 32 ? 0xffffffff : (1 << w) - 1;
      const a = n(ctx.inputs["a"]) & mask;
      const b = n(ctx.inputs["b"]) & mask;
      ctx.outputs["gt"] = a > b ? 1 : 0;
      ctx.outputs["eq"] = a === b ? 1 : 0;
      ctx.outputs["lt"] = a < b ? 1 : 0;
    },
  },
  ALU: {
    type: "ALU",
    label: "ALU 8 bits",
    short: "ALU",
    category: "arithmetic",
    description: "Unidad Aritmético-Lógica de 8 bits. OP: 000=ADD, 001=SUB, 010=AND, 011=OR, 100=XOR, 101=NOT A, 110=SHL, 111=SHR. Flags: Z (cero), C (carry), V (overflow), N (negativo).",
    defaults: { bits: 8, delay: 5 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(5),
    ],
    pins: (p) => [
      busIn("a", "A", W),
      busIn("b", "B", W),
      { id: "op0", name: "OP0", direction: "input", width: 1 },
      { id: "op1", name: "OP1", direction: "input", width: 1 },
      { id: "op2", name: "OP2", direction: "input", width: 1 },
      busOut("out", "R", W),
      { id: "z", name: "Z", direction: "output", width: 1 },
      { id: "c", name: "C", direction: "output", width: 1 },
      { id: "v", name: "V", direction: "output", width: 1 },
      { id: "n", name: "N", direction: "output", width: 1 },
    ],
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      const a = n(ctx.inputs["a"]) & mask;
      const b = n(ctx.inputs["b"]) & mask;
      const op = (n(ctx.inputs["op2"]) << 2) | (n(ctx.inputs["op1"]) << 1) | n(ctx.inputs["op0"]);
      let r = 0, c = 0;
      const signBit = 1 << (w - 1);
      switch (op) {
        case 0: { const t = a + b; r = t & mask; c = (t >> w) & 1; break; }
        case 1: { const t = a + (~b & mask) + 1; r = t & mask; c = (t >> w) & 1; break; }
        case 2: r = a & b; break;
        case 3: r = a | b; break;
        case 4: r = a ^ b; break;
        case 5: r = ~a & mask; break;
        case 6: r = (a << 1) & mask; c = (a >> (w - 1)) & 1; break;
        case 7: r = (a >>> 1) & mask; c = a & 1; break;
      }
      ctx.outputs["out"] = r;
      ctx.outputs["z"] = r === 0 ? 1 : 0;
      ctx.outputs["c"] = c;
      const aNeg = (a & signBit) !== 0;
      const bNeg = (b & signBit) !== 0;
      const rNeg = (r & signBit) !== 0;
      ctx.outputs["n"] = rNeg ? 1 : 0;
      ctx.outputs["v"] = (op === 0 && aNeg === bNeg && aNeg !== rNeg) || (op === 1 && aNeg !== bNeg && aNeg !== rNeg) ? 1 : 0;
    },
    equation: () => "OP: 000=ADD · 001=SUB · 010=AND · 011=OR · 100=XOR · 101=NOT · 110=SHL · 111=SHR",
  },

  // ------------------------------------------------ SECUENCIALES
  LATCH_SR: {
    type: "LATCH_SR",
    label: "Latch SR (NOR)",
    short: "SR",
    category: "sequential",
    description: "Latch Set-Reset con NOR: S=1 → Q=1; R=1 → Q=0; S=R=0 → mantiene; S=R=1 → ESTADO PROHIBIDO (metaestable).",
    defaults: {},
    pins: [
      { id: "s", name: "S", direction: "input", width: 1 },
      { id: "r", name: "R", direction: "input", width: 1 },
      { id: "q", name: "Q", direction: "output", width: 1 },
      { id: "qn", name: "Q'", direction: "output", width: 1 },
    ],
    clickable: true,
    initState: () => ({ q: 0, forbidden: false }),
    eval: (ctx) => {
      const s = n(ctx.inputs["s"]);
      const r = n(ctx.inputs["r"]);
      let q = (ctx.state.q as number) ?? 0;
      if (s === 1 && r === 1) {
        ctx.state.forbidden = true;
        ctx.log("warn", "Latch SR en ESTADO PROHIBIDO (S=R=1): Q y Q' ambos en 0, al soltar el estado es impredecible.");
        q = 0;
      } else {
        ctx.state.forbidden = false;
        if (s === 1 && r === 0) q = 1;
        else if (s === 0 && r === 1) q = 0;
      }
      ctx.state.q = q;
      ctx.outputs["q"] = q;
      ctx.outputs["qn"] = ctx.state.forbidden ? 0 : q ? 0 : 1;
    },
    truthTable: () => ({
      headers: ["S", "R", "Q(t+1)", "Q'"],
      rows: [
        ["0", "0", "Q(t)", "Q'(t)"],
        ["0", "1", "0", "1"],
        ["1", "0", "1", "0"],
        ["1", "1", "PROHIBIDO", "PROHIBIDO"],
      ],
      note: "Estado prohibido: S=R=1 viola la complementariedad de Q y Q'.",
    }),
  },
  LATCH_D: {
    type: "LATCH_D",
    label: "Latch D",
    short: "D",
    category: "sequential",
    description: "Latch D (level-triggered): mientras EN=1 es transparente (Q=D); con EN=0 retiene el último valor. Con reset asíncrono opcional.",
    defaults: { withReset: false },
    propFields: [{ kind: "toggle", key: "withReset", label: "Con reset asíncrono (CLR)" }],
    pins: (p) => {
      const pins: PinDef[] = [
        { id: "d", name: "D", direction: "input" as const, width: 1 },
        { id: "en", name: "EN", direction: "input" as const, width: 1 },
      ];
      if (p.withReset) pins.push({ id: "clr", name: "CLR", direction: "input", width: 1 });
      return pins.concat([
        { id: "q", name: "Q", direction: "output" as const, width: 1 },
        { id: "qn", name: "Q'", direction: "output" as const, width: 1 },
      ]);
    },
    initState: () => ({ q: 0 }),
    eval: (ctx) => {
      if (ctx.props.withReset && n(ctx.inputs["clr"]) === 1) {
        ctx.state.q = 0;
      } else if (n(ctx.inputs["en"]) === 1) {
        ctx.state.q = n(ctx.inputs["d"]);
      }
      const q = (ctx.state.q as number) ?? 0;
      ctx.outputs["q"] = q;
      ctx.outputs["qn"] = q ? 0 : 1;
    },
    truthTable: () => ({
      headers: ["EN", "D", "Q(t+1)"],
      rows: [
        ["0", "X", "Q(t)"],
        ["1", "0", "0"],
        ["1", "1", "1"],
      ],
      note: "Transparente con EN=1 (level-triggered).",
    }),
  },
  FF_D: {
    type: "FF_D",
    label: "Flip-Flop D",
    short: "FF-D",
    category: "sequential",
    description: "FF-D edge-triggered (Master-Slave): captura D en el flanco del clock. Preset y Clear asíncronos. Es la base de registros y contadores síncronos.",
    defaults: { edge: "rising", withAsync: true, tSetup: 0.25, tHold: 0.5, tProp: 0.75 },
    propFields: [
      { kind: "select", key: "edge", label: "Flanco activo", options: [
        { value: "rising", label: "Ascendente (↑)" },
        { value: "falling", label: "Descendente (↓)" },
      ] },
      { kind: "toggle", key: "withAsync", label: "Preset / Clear asíncronos" },
      { kind: "number", key: "tSetup", label: "t_setup", min: 0, max: 10, step: 0.05, suffix: "ns" },
      { kind: "number", key: "tHold", label: "t_hold", min: 0, max: 10, step: 0.05, suffix: "ns" },
      { kind: "number", key: "tProp", label: "t_propagation", min: 0, max: 10, step: 0.05, suffix: "ns" },
    ],
    pins: (p) => {
      const pins: PinDef[] = [
        { id: "d", name: "D", direction: "input" as const, width: 1 },
        { id: "clk", name: "▸", direction: "input" as const, width: 1 },
      ];
      if (p.withAsync) {
        pins.push({ id: "pre", name: "PRE", direction: "input", width: 1 });
        pins.push({ id: "clr", name: "CLR", direction: "input", width: 1 });
      }
      return pins.concat([
        { id: "q", name: "Q", direction: "output" as const, width: 1 },
        { id: "qn", name: "Q'", direction: "output" as const, width: 1 },
      ]);
    },
    initState: () => ({ q: 0 }),
    eval: (ctx) => {
      const rising = (ctx.props.edge as string) !== "falling";
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      const edge = rising ? prevClk === 0 && clk === 1 : prevClk === 1 && clk === 0;
      if (ctx.props.withAsync && n(ctx.inputs["clr"]) === 1) ctx.state.q = 0;
      else if (ctx.props.withAsync && n(ctx.inputs["pre"]) === 1) ctx.state.q = 1;
      else if (edge) ctx.state.q = n(ctx.inputs["d"]);
      const q = (ctx.state.q as number) ?? 0;
      ctx.outputs["q"] = q;
      ctx.outputs["qn"] = q ? 0 : 1;
    },
    truthTable: () => ({
      headers: ["CLK", "D", "Q(t+1)"],
      rows: [
        ["↑", "0", "0"],
        ["↑", "1", "1"],
        ["0/1/↓", "X", "Q(t)"],
      ],
      note: "Sensible al flanco ascendente. t_setup, t_hold y t_prop configuran el análisis temporal.",
    }),
  },
  FF_JK: {
    type: "FF_JK",
    label: "Flip-Flop JK",
    short: "FF-JK",
    category: "sequential",
    description: "FF-JK: J=K=0 mantiene; J=1 K=0 set; J=0 K=1 reset; J=K=1 toggle. Universal: con lógica extra se convierte en FF-D o FF-T.",
    defaults: { edge: "rising" },
    propFields: [
      { kind: "select", key: "edge", label: "Flanco activo", options: [
        { value: "rising", label: "Ascendente (↑)" },
        { value: "falling", label: "Descendente (↓)" },
      ] },
    ],
    pins: [
      { id: "j", name: "J", direction: "input", width: 1 },
      { id: "k", name: "K", direction: "input", width: 1 },
      { id: "clk", name: "▸", direction: "input", width: 1 },
      { id: "q", name: "Q", direction: "output", width: 1 },
      { id: "qn", name: "Q'", direction: "output", width: 1 },
    ],
    initState: () => ({ q: 0 }),
    eval: (ctx) => {
      const rising = (ctx.props.edge as string) !== "falling";
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      const edge = rising ? prevClk === 0 && clk === 1 : prevClk === 1 && clk === 0;
      if (edge) {
        const j = n(ctx.inputs["j"]);
        const k = n(ctx.inputs["k"]);
        const q = (ctx.state.q as number) ?? 0;
        if (j === 0 && k === 0) ctx.state.q = q;
        else if (j === 1 && k === 0) ctx.state.q = 1;
        else if (j === 0 && k === 1) ctx.state.q = 0;
        else ctx.state.q = q ? 0 : 1;
      }
      const q = (ctx.state.q as number) ?? 0;
      ctx.outputs["q"] = q;
      ctx.outputs["qn"] = q ? 0 : 1;
    },
    truthTable: () => ({
      headers: ["J", "K", "Q(t+1)"],
      rows: [
        ["0", "0", "Q(t)"],
        ["1", "0", "1"],
        ["0", "1", "0"],
        ["1", "1", "Q'(t) — toggle"],
      ],
      note: "Conversiones: FF-JK desde FF-D: D = J·Q' + K'·Q · FF-T desde FF-JK: J = K = T",
    }),
  },
  FF_T: {
    type: "FF_T",
    label: "Flip-Flop T",
    short: "FF-T",
    category: "sequential",
    description: "FF-T (toggle): con T=1 alterna el estado en cada flanco → divide la frecuencia por 2. Cadenas de FF-T = divisores de frecuencia / contadores.",
    defaults: { edge: "rising" },
    propFields: [
      { kind: "select", key: "edge", label: "Flanco activo", options: [
        { value: "rising", label: "Ascendente (↑)" },
        { value: "falling", label: "Descendente (↓)" },
      ] },
    ],
    pins: [
      { id: "t", name: "T", direction: "input", width: 1 },
      { id: "clk", name: "▸", direction: "input", width: 1 },
      { id: "q", name: "Q", direction: "output", width: 1 },
      { id: "qn", name: "Q'", direction: "output", width: 1 },
    ],
    initState: () => ({ q: 0 }),
    eval: (ctx) => {
      const rising = (ctx.props.edge as string) !== "falling";
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      const edge = rising ? prevClk === 0 && clk === 1 : prevClk === 1 && clk === 0;
      if (edge && n(ctx.inputs["t"]) === 1) {
        ctx.state.q = ((ctx.state.q as number) ?? 0) ? 0 : 1;
      }
      const q = (ctx.state.q as number) ?? 0;
      ctx.outputs["q"] = q;
      ctx.outputs["qn"] = q ? 0 : 1;
    },
    truthTable: () => ({
      headers: ["T", "Q(t+1)"],
      rows: [
        ["0", "Q(t)"],
        ["1", "Q'(t) — toggle"],
      ],
      note: "Divisor de frecuencia: cada FF-T divide por 2. Para dividir m/n = 2^i se necesitan i FFs.",
    }),
  },
  REG_PIPO: {
    type: "REG_PIPO",
    label: "Registro PIPO",
    short: "REG",
    category: "sequential",
    description: "Registro Parallel-In Parallel-Out de N bits: con LOAD=1 carga D en el flanco del clock; CLR asíncrono pone la salida en 0.",
    defaults: { bits: 4, delay: 1 },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [1, 2, 4, 8, 16].map((v) => ({ value: v, label: `${v} bits` })) },
      delayField(1),
    ],
    pins: (p) => [
      busIn("d", "D", W),
      { id: "load", name: "LOAD", direction: "input", width: 1 },
      { id: "clk", name: "▸", direction: "input", width: 1 },
      { id: "clr", name: "CLR", direction: "input", width: 1 },
      busOut("q", "Q", W),
    ],
    initState: () => ({ data: 0 }),
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      if (n(ctx.inputs["clr"]) === 1) ctx.state.data = 0;
      else {
        const clk = n(ctx.inputs["clk"]);
        const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
        if (prevClk === 0 && clk === 1 && n(ctx.inputs["load"]) === 1) {
          ctx.state.data = n(ctx.inputs["d"]) & mask;
        }
      }
      ctx.outputs["q"] = (ctx.state.data as number) ?? 0;
    },
  },
  REG_UNIVERSAL: {
    type: "REG_UNIVERSAL",
    label: "Registro Universal",
    short: "UNIV",
    category: "sequential",
    description: "Registro universal de N bits con modo (M1 M0): 00=retención, 01=shift right (desde la izquierda), 10=shift left (desde la derecha), 11=carga paralela.",
    defaults: { bits: 4 },
    propFields: [{ kind: "select", key: "bits", label: "Bits", options: [4, 8].map((v) => ({ value: v, label: `${v} bits` })) }],
    pins: (p) => [
      { id: "sinL", name: "SL", direction: "input", width: 1 },
      { id: "sinR", name: "SR", direction: "input", width: 1 },
      busIn("d", "D", W),
      { id: "m1", name: "M1", direction: "input", width: 1 },
      { id: "m0", name: "M0", direction: "input", width: 1 },
      { id: "clk", name: "▸", direction: "input", width: 1 },
      { id: "clr", name: "CLR", direction: "input", width: 1 },
      busOut("q", "Q", W),
      { id: "sout", name: "SO", direction: "output", width: 1 },
    ],
    initState: () => ({ data: 0 }),
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      if (n(ctx.inputs["clr"]) === 1) ctx.state.data = 0;
      else {
        const clk = n(ctx.inputs["clk"]);
        const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
        if (prevClk === 0 && clk === 1) {
          const data = (ctx.state.data as number) ?? 0;
          const mode = (n(ctx.inputs["m1"]) << 1) | n(ctx.inputs["m0"]);
          if (mode === 1) ctx.state.data = (((n(ctx.inputs["sinL"]) << w) | data) >> 1) & mask;
          else if (mode === 2) ctx.state.data = (((data << 1) | n(ctx.inputs["sinR"])) & mask);
          else if (mode === 3) ctx.state.data = n(ctx.inputs["d"]) & mask;
        }
      }
      const data = (ctx.state.data as number) ?? 0;
      ctx.outputs["q"] = data;
      ctx.outputs["sout"] = data & 1;
    },
  },
  REGISTER_FILE: {
    type: "REGISTER_FILE",
    label: "Banco de Registros",
    short: "REGF",
    category: "sequential",
    description: "N registros de M bits con 2 puertos de lectura (A, B) y 1 de escritura. Lectura asíncrona por dirección; escritura síncrona con WE. Núcleo del datapath del procesador. Implementado con MUX de lectura y decodificador de escritura.",
    defaults: { numRegs: 8, bits: 8 },
    propFields: [
      { kind: "select", key: "numRegs", label: "Registros", options: [4, 8].map((v) => ({ value: v, label: `${v} × ` })) },
      { kind: "select", key: "bits", label: "Bits", options: [4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
    ],
    pins: (p) => {
      const nRegs = (p.numRegs as number) ?? 8;
      const ab = bitsOf(nRegs);
      const w = W(p);
      return [
        { id: "ra", name: "RA", direction: "input", width: ab },
        { id: "rb", name: "RB", direction: "input", width: ab },
        { id: "wa", name: "WA", direction: "input", width: ab },
        busIn("wd", "WD", () => w),
        { id: "we", name: "WE", direction: "input", width: 1 },
        { id: "clk", name: "▸", direction: "input", width: 1 },
        busOut("qa", "QA", () => w),
        busOut("qb", "QB", () => w),
      ];
    },
    initState: () => ({ regs: [0, 0, 0, 0, 0, 0, 0, 0] }),
    eval: (ctx) => {
      const nRegs = (ctx.props.numRegs as number) ?? 8;
      const regs = (ctx.state.regs as number[]) ?? new Array(nRegs).fill(0);
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      if (prevClk === 0 && clk === 1 && n(ctx.inputs["we"]) === 1) {
        const wa = n(ctx.inputs["wa"]) % nRegs;
        regs[wa] = n(ctx.inputs["wd"]);
      }
      ctx.state.regs = regs;
      ctx.outputs["qa"] = regs[n(ctx.inputs["ra"]) % nRegs] ?? 0;
      ctx.outputs["qb"] = regs[n(ctx.inputs["rb"]) % nRegs] ?? 0;
    },
  },

  // ------------------------------------------------ CONTADORES
  COUNTER_SYNC_UP: {
    type: "COUNTER_SYNC_UP",
    label: "Contador Síncrono ↑",
    short: "CNT↑",
    category: "sequential",
    description: "Contador síncrono ascendente de N bits (FF-D o FF-T en cascada): con EN=1 incrementa en cada flanco. TC (terminal count) permite encadenar contadores.",
    defaults: { bits: 4, autoLoad: false },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [2, 3, 4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      { kind: "toggle", key: "autoLoad", label: "Recarga automática al llegar a máx." },
    ],
    pins: (p) => {
      const w = W(p);
      const pins: PinDef[] = [
        { id: "clk", name: "▸", direction: "input", width: 1 },
        { id: "en", name: "EN", direction: "input", width: 1 },
        { id: "load", name: "LOAD", direction: "input", width: 1 },
        busIn("d", "D", () => w),
        { id: "clr", name: "CLR", direction: "input", width: 1 },
      ];
      return pins.concat([busOut("q", "Q", () => w), { id: "tc", name: "TC", direction: "output", width: 1 }]);
    },
    initState: () => ({ data: 0 }),
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      if (n(ctx.inputs["clr"]) === 1) ctx.state.data = 0;
      else {
        const clk = n(ctx.inputs["clk"]);
        const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
        if (prevClk === 0 && clk === 1) {
          const data = (ctx.state.data as number) ?? 0;
          if (n(ctx.inputs["load"]) === 1) ctx.state.data = n(ctx.inputs["d"]) & mask;
          else if (n(ctx.inputs["en"]) === 1) {
            const next = (data + 1) & mask;
            ctx.state.data = ctx.props.autoLoad && next === 0 && data === mask ? (n(ctx.inputs["d"]) & mask) : next;
          }
        }
      }
      const data = (ctx.state.data as number) ?? 0;
      ctx.outputs["q"] = data;
      ctx.outputs["tc"] = data === mask && n(ctx.inputs["en"]) === 1 ? 1 : 0;
    },
  },
  COUNTER_SYNC_DOWN: {
    type: "COUNTER_SYNC_DOWN",
    label: "Contador Síncrono ↓",
    short: "CNT↓",
    category: "sequential",
    description: "Contador síncrono descendente de N bits: decrementa con EN=1. Con recarga automática: al llegar a 0 recarga el valor de D (útil para timers/divisores programables).",
    defaults: { bits: 4, autoLoad: true },
    propFields: [
      { kind: "select", key: "bits", label: "Bits", options: [2, 3, 4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      { kind: "toggle", key: "autoLoad", label: "Recargar D al llegar a 0" },
    ],
    pins: (p) => {
      const w = W(p);
      return [
        { id: "clk", name: "▸", direction: "input", width: 1 },
        { id: "en", name: "EN", direction: "input", width: 1 },
        { id: "load", name: "LOAD", direction: "input", width: 1 },
        busIn("d", "D", () => w),
        { id: "clr", name: "CLR", direction: "input", width: 1 },
        busOut("q", "Q", () => w),
        { id: "tc", name: "TC(=0)", direction: "output", width: 1 },
      ];
    },
    initState: () => ({ data: 0 }),
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      if (n(ctx.inputs["clr"]) === 1) ctx.state.data = 0;
      else {
        const clk = n(ctx.inputs["clk"]);
        const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
        if (prevClk === 0 && clk === 1) {
          const data = (ctx.state.data as number) ?? 0;
          if (n(ctx.inputs["load"]) === 1) ctx.state.data = n(ctx.inputs["d"]) & mask;
          else if (n(ctx.inputs["en"]) === 1) {
            if (data === 0 && ctx.props.autoLoad) ctx.state.data = n(ctx.inputs["d"]) & mask;
            else ctx.state.data = (data - 1 + (1 << w)) & mask;
          }
        }
      }
      const data = (ctx.state.data as number) ?? 0;
      ctx.outputs["q"] = data;
      ctx.outputs["tc"] = data === 0 && n(ctx.inputs["en"]) === 1 ? 1 : 0;
    },
  },
  COUNTER_ASYNC: {
    type: "COUNTER_ASYNC",
    label: "Contador Asíncrono (Ripple)",
    short: "RIP",
    category: "sequential",
    description: "Contador ripple: el clock de cada FF es la salida del anterior. Más simple pero más lento: el retardo se acumula bit a bit (2^N peor caso).",
    defaults: { bits: 4 },
    propFields: [{ kind: "select", key: "bits", label: "Bits", options: [2, 3, 4, 8].map((v) => ({ value: v, label: `${v} bits` })) }],
    pins: (p) => {
      const w = W(p);
      return [
        { id: "clk", name: "▸", direction: "input", width: 1 },
        { id: "clr", name: "CLR", direction: "input", width: 1 },
        busOut("q", "Q", () => w),
      ];
    },
    initState: () => ({ data: 0 }),
    eval: (ctx) => {
      const w = W(ctx.props);
      const mask = (1 << w) - 1;
      if (n(ctx.inputs["clr"]) === 1) ctx.state.data = 0;
      else {
        const clk = n(ctx.inputs["clk"]);
        const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
        // Los FF del ripple alternan con el flanco descendente del clock del escenario
        if (prevClk === 1 && clk === 0) {
          ctx.state.data = (((ctx.state.data as number) ?? 0) + 1) & mask;
        }
      }
      ctx.outputs["q"] = (ctx.state.data as number) ?? 0;
    },
  },
  FREQ_DIVIDER: {
    type: "FREQ_DIVIDER",
    label: "Divisor de Frecuencia",
    short: "÷2ⁿ",
    category: "sequential",
    description: "Divide la frecuencia del reloj por 2^etapas usando una cadena de FF-T. Ej.: 100MHz ÷ 2³ = 12.5MHz con 3 FFs.",
    defaults: { stages: 3 },
    propFields: [{ kind: "number", key: "stages", label: "Etapas FF-T (÷2ⁿ)", min: 1, max: 8, step: 1 }],
    pins: [
      { id: "clk", name: "▸", direction: "input", width: 1 },
      { id: "out", name: "OUT", direction: "output", width: 1 },
    ],
    initState: () => ({ count: 0 }),
    eval: (ctx) => {
      const stages = (ctx.props.stages as number) ?? 3;
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      if (prevClk === 0 && clk === 1) {
        ctx.state.count = (((ctx.state.count as number) ?? 0) + 1) % (1 << stages);
      }
      ctx.outputs["out"] = ((ctx.state.count as number) ?? 0) >> (stages - 1) & 1;
    },
  },

  // ------------------------------------------------ SÍNTESIS
  LUT: {
    type: "LUT",
    label: "LUT (Look-Up Table)",
    short: "LUT",
    category: "synthesis",
    description: "LUT de FPGA: implementa CUALQUIER función booleana de hasta 6 variables mediante una tabla de verdad programable (64 bits de configuración en LUT6). Núcleo del Slice.",
    defaults: { nIn: 3, table: [0, 1, 1, 0, 1, 1, 1, 1], delay: 1.5 },
    propFields: [
      { kind: "select", key: "nIn", label: "Entradas", options: [1, 2, 3, 4, 5, 6].map((v) => ({ value: v, label: `LUT${v} (${1 << v} bits)` })) },
      { kind: "custom", key: "table", label: "Tabla de configuración" },
      delayField(1.5),
    ],
    pins: (p) => {
      const k = (p.nIn as number) ?? 3;
      return [
        ...Array.from({ length: k }, (_, i) => ({ id: `i${i}`, name: `I${i}`, direction: "input" as const, width: 1 })),
        { id: "out", name: "O", direction: "output" as const, width: 1 },
      ];
    },
    eval: (ctx) => {
      const k = (ctx.props.nIn as number) ?? 3;
      let idx = 0;
      for (let i = 0; i < k; i++) idx |= n(ctx.inputs[`i${i}`]) << i;
      const table = (ctx.props.table as number[]) ?? [];
      ctx.outputs["out"] = table[idx] ?? 0;
    },
    truthTable: (p) => {
      const k = (p.nIn as number) ?? 3;
      const table = (p.table as number[]) ?? [];
      const rows: string[][] = [];
      for (let m = 0; m < 1 << k; m++) {
        const vals = Array.from({ length: k }, (_, i) => ((m >> (k - 1 - i)) & 1).toString());
        rows.push([...vals, String(table[m] ?? 0)]);
      }
      return { headers: [...Array.from({ length: k }, (_, i) => `I${i}`), "O"], rows, note: "Contenido de la LUT programable — equivale a la memoria de la función." };
    },
  },
  ROM: {
    type: "ROM",
    label: "ROM",
    short: "ROM",
    category: "synthesis",
    description: "Memoria de solo lectura: 2^addrBits celdas × dataBits. Implementa funciones por tabla: 1 celda por mintérmino, 2^n − 1 celdas por maxtérmino.",
    defaults: { addrBits: 3, dataBits: 6, contents: [6, 5, 4, 9, 0, 1, 2, 63] },
    propFields: [
      { kind: "select", key: "addrBits", label: "Bits de dirección", options: [2, 3].map((v) => ({ value: v, label: `${1 << v} celdas` })) },
      { kind: "select", key: "dataBits", label: "Bits de dato", options: [1, 4, 6, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      { kind: "custom", key: "contents", label: "Contenido" },
    ],
    pins: (p) => [
      { id: "a", name: "A", direction: "input", width: (p.addrBits as number) ?? 3 },
      busOut("d", "D", (pp) => (pp.dataBits as number) ?? 6),
    ],
    eval: (ctx) => {
      const addrBits = (ctx.props.addrBits as number) ?? 3;
      const contents = (ctx.props.contents as number[]) ?? [];
      const addr = n(ctx.inputs["a"]) & ((1 << addrBits) - 1);
      ctx.outputs["d"] = contents[addr] ?? 0;
    },
  },
  PLA: {
    type: "PLA",
    label: "PLA",
    short: "PLA",
    category: "synthesis",
    description: "Programmable Logic Array: plano AND programable (literales por término de producto) + plano OR programable (qué términos suman cada salida).",
    defaults: {
      nIn: 3,
      nOut: 2,
      // andTerms[t][i]: 0 = directa, 1 = negada, -1 = no conectada
      andTerms: [
        [0, 1, -1],
        [-1, 0, 1],
        [0, 0, 0],
      ],
      // orMatrix[o][t]
      orMatrix: [
        [1, 1, 0],
        [0, 0, 1],
      ],
    },
    propFields: [
      { kind: "number", key: "nIn", label: "Entradas", min: 2, max: 5, step: 1 },
      { kind: "number", key: "nOut", label: "Salidas", min: 1, max: 4, step: 1 },
      { kind: "custom", key: "andTerms", label: "Plano AND" },
    ],
    pins: (p) => {
      const nIn = (p.nIn as number) ?? 3;
      const nOut = (p.nOut as number) ?? 2;
      return [
        ...Array.from({ length: nIn }, (_, i) => ({ id: `i${i}`, name: `I${i}`, direction: "input" as const, width: 1 })),
        ...Array.from({ length: nOut }, (_, i) => ({ id: `o${i}`, name: `F${i}`, direction: "output" as const, width: 1 })),
      ];
    },
    eval: (ctx) => {
      const nIn = (ctx.props.nIn as number) ?? 3;
      const nOut = (ctx.props.nOut as number) ?? 2;
      const andTerms = (ctx.props.andTerms as number[][]) ?? [];
      const orMatrix = (ctx.props.orMatrix as number[][]) ?? [];
      const termVals = andTerms.map((term) => {
        let v = 1;
        for (let i = 0; i < nIn; i++) {
          const c = term[i] ?? -1;
          if (c === -1) continue;
          const lit = n(ctx.inputs[`i${i}`]);
          v &= c === 0 ? lit : lit ? 0 : 1;
          if (v === 0) break;
        }
        return v;
      });
      for (let o = 0; o < nOut; o++) {
        let v = 0;
        for (let t = 0; t < termVals.length; t++) v |= (orMatrix[o]?.[t] ?? 0) & termVals[t];
        ctx.outputs[`o${o}`] = v;
      }
    },
  },

  // ------------------------------------------------ PROCESADOR
  RAM: {
    type: "RAM",
    label: "RAM",
    short: "RAM",
    category: "processor",
    description: "Memoria RAM: 2^addrBits celdas × dataBits. Escritura síncrona con WE=1 en el flanco del clock; lectura asíncrona. Editor hex integrado.",
    defaults: { addrBits: 8, dataBits: 8, contents: [] as number[], delay: 4 },
    propFields: [
      { kind: "select", key: "addrBits", label: "Tamaño", options: [
        { value: 4, label: "16 celdas" },
        { value: 6, label: "64 celdas" },
        { value: 8, label: "256 celdas" },
      ] },
      { kind: "select", key: "dataBits", label: "Palabra", options: [1, 4, 8].map((v) => ({ value: v, label: `${v} bits` })) },
      { kind: "custom", key: "contents", label: "Contenido (hex)" },
      delayField(4),
    ],
    pins: (p) => {
      const ab = (p.addrBits as number) ?? 8;
      const db = (p.dataBits as number) ?? 8;
      return [
        { id: "a", name: "ADDR", direction: "input", width: ab },
        busIn("din", "DIN", () => db),
        { id: "we", name: "WE", direction: "input", width: 1 },
        { id: "clk", name: "▸", direction: "input", width: 1 },
        busOut("dout", "DOUT", () => db),
      ];
    },
    initState: () => ({ mem: {} as Record<number, number> }),
    eval: (ctx) => {
      const ab = (ctx.props.addrBits as number) ?? 8;
      const db = (ctx.props.dataBits as number) ?? 8;
      const dbits = 1 << db;
      const contents = (ctx.props.contents as number[]) ?? [];
      const mem = (ctx.state.mem as Record<number, number>) ?? {};
      const addr = n(ctx.inputs["a"]) & ((1 << ab) - 1);
      const clk = n(ctx.inputs["clk"]);
      const prevClk = ctx.prevInputs["clk"] === undefined ? 0 : n(ctx.prevInputs["clk"]);
      if (prevClk === 0 && clk === 1 && n(ctx.inputs["we"]) === 1) {
        mem[addr] = n(ctx.inputs["din"]) & (dbits - 1);
        ctx.state.mem = mem;
      }
      const ext = contents[addr] ?? 0;
      const val = mem[addr] ?? ext;
      ctx.outputs["dout"] = val;
    },
  },
};

// Utilidad pública: crear definición por tipo
export const getDef = (type: ComponentType): ComponentDef => CATALOG[type];

export const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: "gates", label: "Compuertas", color: "#00AAFF" },
  { id: "wiring", label: "Conexión", color: "#8B98A5" },
  { id: "plexers", label: "Plexers", color: "#C792EA" },
  { id: "arithmetic", label: "Aritmética", color: "#FFCB6B" },
  { id: "sequential", label: "Secuenciales", color: "#00FF88" },
  { id: "synthesis", label: "Síntesis", color: "#FF8A65" },
  { id: "processor", label: "Procesador", color: "#EF5350" },
];

/** retardo por defecto de un tipo (para análisis temporal) */
export const defaultDelay = (type: ComponentType): number => {
  const d = CATALOG[type]?.defaults?.delay;
  return typeof d === "number" ? d : 0;
};
