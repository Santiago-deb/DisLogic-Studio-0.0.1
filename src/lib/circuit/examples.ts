// ============================================================
// DisLogic — Galería de circuitos de ejemplo precargados
// Enunciados clásicos de finales de Diseño Lógico (UTN)
// Cada build() genera un CircuitData NUEVO (ids únicos por invocación)
// ============================================================
import { CATALOG } from "./catalog";
import { buildSopCircuit } from "./synth";
import type { CircuitData, ComponentInstance, ComponentType, Wire } from "./types";

export interface ExampleCircuit {
  id: string;
  name: string;
  module: 1 | 2 | 3 | 4 | 5;
  description: string;
  build: () => CircuitData;
}

// ---------- helpers de construcción ----------

let uid = 0;
const nid = (prefix: string) => `${prefix}_ex${Date.now().toString(36)}${(uid++).toString(36)}`;

/** Instancia nueva con los defaults del catálogo + overrides */
function mk(type: ComponentType, x: number, y: number, props: Record<string, unknown> = {}, label?: string): ComponentInstance {
  const def = CATALOG[type];
  const defaults = JSON.parse(JSON.stringify(def.defaults ?? {})) as Record<string, unknown>;
  return { id: nid("c"), type, x, y, props: { ...defaults, ...props }, label: label ?? def.label };
}

function conn(wires: Wire[], from: ComponentInstance, fromPin: string, to: ComponentInstance, toPin: string): void {
  wires.push({ id: nid("w"), fromComponent: from.id, fromPin, toComponent: to.id, toPin });
}

const inPin = (x: number, y: number, label: string) => mk("INPUT_PIN", x, y, {}, label);
const outPin = (x: number, y: number, label: string) => mk("OUTPUT_PIN", x, y, {}, label);

// ============================================================
// MÓDULO 1 — Compuertas y combinacionales básicos
// ============================================================

/** NOT con NAND: ambas entradas de la NAND unidas al mismo INPUT_PIN */
function buildNandNot(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 140, "A");
  const g = mk("NAND", 320, 130, {}, "NAND");
  const s = outPin(540, 150, "S = A'");
  comps.push(a, g, s);
  conn(wires, a, "out", g, "in0");
  conn(wires, a, "out", g, "in1");
  conn(wires, g, "out", s, "in0");
  return { name: "NOT con NAND", components: comps, wires };
}

/** AND con NAND: NAND + inversor NAND */
function buildNandAnd(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 80, "A");
  const b = inPin(80, 200, "B");
  const n1 = mk("NAND", 300, 120, {}, "NAND (A·B)'");
  const n2 = mk("NAND", 520, 130, {}, "NAND inversor");
  const s = outPin(720, 150, "S = A·B");
  comps.push(a, b, n1, n2, s);
  conn(wires, a, "out", n1, "in0");
  conn(wires, b, "out", n1, "in1");
  conn(wires, n1, "out", n2, "in0");
  conn(wires, n1, "out", n2, "in1");
  conn(wires, n2, "out", s, "in0");
  return { name: "AND con NAND", components: comps, wires };
}

/** OR con NOR + NOR (De Morgan): A+B = NOR(NOR(A,B), NOR(A,B)) */
function buildNandOr(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 100, "A");
  const b = inPin(80, 220, "B");
  const n1 = mk("NOR", 300, 140, {}, "NOR (A+B)'");
  const n2 = mk("NOR", 520, 150, {}, "NOR inversor");
  const s = outPin(720, 160, "S = A+B");
  comps.push(a, b, n1, n2, s);
  conn(wires, a, "out", n1, "in0");
  conn(wires, b, "out", n1, "in1");
  conn(wires, n1, "out", n2, "in0");
  conn(wires, n1, "out", n2, "in1");
  conn(wires, n2, "out", s, "in0");
  return { name: "OR con NOR (De Morgan)", components: comps, wires };
}

/** MUX 2:1 con AND-OR: S = A·sel' + B·sel */
function buildMux21Gates(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 70, "A");
  const b = inPin(80, 190, "B");
  const sel = inPin(80, 330, "sel");
  const inv = mk("NOT", 280, 330, {}, "sel'");
  const and1 = mk("AND", 470, 60, {}, "A·sel'");
  const and2 = mk("AND", 470, 180, {}, "B·sel");
  const or = mk("OR", 670, 120, {}, "OR");
  const s = outPin(860, 140, "S");
  comps.push(a, b, sel, inv, and1, and2, or, s);
  conn(wires, a, "out", and1, "in0");
  conn(wires, sel, "out", inv, "in0");
  conn(wires, inv, "out", and1, "in1");
  conn(wires, b, "out", and2, "in0");
  conn(wires, sel, "out", and2, "in1");
  conn(wires, and1, "out", or, "in0");
  conn(wires, and2, "out", or, "in1");
  conn(wires, or, "out", s, "in0");
  return { name: "MUX 2:1 con AND-OR", components: comps, wires };
}

/** MUX 2:1 solo NAND: S = ((A·sel')' · (B·sel)')' con la NAND como inversor */
function buildMux21Nand(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 70, "A");
  const b = inPin(80, 190, "B");
  const sel = inPin(80, 340, "sel");
  const ninv = mk("NAND", 290, 340, {}, "NAND inv (sel')");
  const n1 = mk("NAND", 500, 90, {}, "NAND1 (A·sel')'");
  const n2 = mk("NAND", 500, 210, {}, "NAND2 (B·sel)'");
  const n3 = mk("NAND", 700, 150, {}, "NAND3");
  const s = outPin(890, 170, "S");
  comps.push(a, b, sel, ninv, n1, n2, n3, s);
  conn(wires, sel, "out", ninv, "in0");
  conn(wires, sel, "out", ninv, "in1");
  conn(wires, a, "out", n1, "in0");
  conn(wires, ninv, "out", n1, "in1");
  conn(wires, b, "out", n2, "in0");
  conn(wires, sel, "out", n2, "in1");
  conn(wires, n1, "out", n3, "in0");
  conn(wires, n2, "out", n3, "in1");
  conn(wires, n3, "out", s, "in0");
  return { name: "MUX 2:1 solo NAND", components: comps, wires };
}

/** DMUX 1:2 con compuertas: O0 = D·sel', O1 = D·sel */
function buildDmux21(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const d = inPin(80, 80, "D");
  const sel = inPin(80, 280, "sel");
  const inv = mk("NOT", 280, 280, {}, "sel'");
  const and1 = mk("AND", 470, 70, {}, "D·sel'");
  const and2 = mk("AND", 470, 190, {}, "D·sel");
  const o0 = outPin(670, 90, "O0");
  const o1 = outPin(670, 210, "O1");
  comps.push(d, sel, inv, and1, and2, o0, o1);
  conn(wires, d, "out", and1, "in0");
  conn(wires, sel, "out", inv, "in0");
  conn(wires, inv, "out", and1, "in1");
  conn(wires, d, "out", and2, "in0");
  conn(wires, sel, "out", and2, "in1");
  conn(wires, and1, "out", o0, "in0");
  conn(wires, and2, "out", o1, "in0");
  return { name: "DMUX 1:2 con compuertas", components: comps, wires };
}

/** Full Adder con compuertas: Sum = A⊕B⊕Cin, Cout = AB + ACin + BCin */
function buildFa(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 60, "A");
  const b = inPin(80, 170, "B");
  const cin = inPin(80, 280, "Cin");
  const xor1 = mk("XOR", 300, 100, {}, "A⊕B");
  const xor2 = mk("XOR", 520, 140, {}, "⊕Cin");
  const sum = outPin(740, 160, "Sum");
  const and1 = mk("AND", 300, 360, {}, "A·B");
  const and2 = mk("AND", 300, 470, {}, "A·Cin");
  const and3 = mk("AND", 300, 580, {}, "B·Cin");
  const or = mk("OR", 520, 460, { nIn: 3 }, "mayoría");
  const cout = outPin(740, 480, "Cout");
  comps.push(a, b, cin, xor1, xor2, sum, and1, and2, and3, or, cout);
  conn(wires, a, "out", xor1, "in0");
  conn(wires, b, "out", xor1, "in1");
  conn(wires, xor1, "out", xor2, "in0");
  conn(wires, cin, "out", xor2, "in1");
  conn(wires, xor2, "out", sum, "in0");
  conn(wires, a, "out", and1, "in0");
  conn(wires, b, "out", and1, "in1");
  conn(wires, a, "out", and2, "in0");
  conn(wires, cin, "out", and2, "in1");
  conn(wires, b, "out", and3, "in0");
  conn(wires, cin, "out", and3, "in1");
  conn(wires, and1, "out", or, "in0");
  conn(wires, and2, "out", or, "in1");
  conn(wires, and3, "out", or, "in2");
  conn(wires, or, "out", cout, "in0");
  return { name: "Full Adder (compuertas)", components: comps, wires };
}

/** Sumador ripple de 4 bits: 4 FULL_ADDER encadenados cout→cin */
function buildAdder4(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const fas: ComponentInstance[] = [];
  for (let i = 0; i < 4; i++) {
    const colX = 170 + i * 215;
    const ai = inPin(colX, 90, `A${i}`);
    const bi = inPin(colX, 200, `B${i}`);
    const fa = mk("FULL_ADDER", colX, 330, {}, `FA${i}`);
    const si = outPin(colX, 490, `Sum${i}`);
    comps.push(ai, bi, fa, si);
    fas.push(fa);
    conn(wires, ai, "out", fa, "a0");
    conn(wires, bi, "out", fa, "b0");
    conn(wires, fa, "sum", si, "in0");
    if (i > 0) conn(wires, fas[i - 1], "cout", fa, "cin");
  }
  const cin = inPin(50, 480, "Cin");
  const cout = outPin(1040, 340, "Cout");
  comps.push(cin, cout);
  conn(wires, cin, "out", fas[0], "cin");
  conn(wires, fas[3], "cout", cout, "in0");
  return { name: "Sumador Ripple 4 bits", components: comps, wires };
}

// ============================================================
// MÓDULO 2 — Karnaugh y síntesis (FPGA)
// ============================================================

/** F = Σm(0,2,4,6,8,9,10,11,15) sintetizada con buildSopCircuit (Quine-McCluskey) */
function buildKmapDemo(): CircuitData {
  const built = buildSopCircuit([0, 2, 4, 6, 8, 9, 10, 11, 15], [], 4, 80, 80);
  return { name: `F = ${built.expression} (Karnaugh)`, components: built.components, wires: built.wires };
}

/** Full Adder con 2 LUTs (estilo FPGA): tabla de Sum y tabla de Cout */
function buildLutFa(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const a = inPin(80, 100, "A");
  const b = inPin(80, 240, "B");
  const cin = inPin(80, 380, "Cin");
  const lutSum = mk("LUT", 380, 120, { nIn: 3, table: [0, 1, 1, 0, 1, 0, 0, 1], delay: 1.5 }, "LUT Sum");
  const lutCout = mk("LUT", 380, 320, { nIn: 3, table: [0, 0, 0, 1, 0, 1, 1, 1], delay: 1.5 }, "LUT Cout");
  const sum = outPin(650, 140, "Sum");
  const cout = outPin(650, 340, "Cout");
  comps.push(a, b, cin, lutSum, lutCout, sum, cout);
  conn(wires, a, "out", lutSum, "i0");
  conn(wires, b, "out", lutSum, "i1");
  conn(wires, cin, "out", lutSum, "i2");
  conn(wires, a, "out", lutCout, "i0");
  conn(wires, b, "out", lutCout, "i1");
  conn(wires, cin, "out", lutCout, "i2");
  conn(wires, lutSum, "out", sum, "in0");
  conn(wires, lutCout, "out", cout, "in0");
  return { name: "Sumador en FPGA (LUTs)", components: comps, wires };
}

// ============================================================
// MÓDULO 3 — Secuenciales
// ============================================================

/** Latch SR con 2 NOR realimentadas cruzadas: Q=(R+Q')', Q'=(S+Q)' */
function buildLatchSr(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const r = inPin(80, 100, "R");
  const s = inPin(80, 330, "S");
  const norQ = mk("NOR", 360, 100, {}, "Q = (R+Q')'");
  const norQn = mk("NOR", 360, 330, {}, "Q' = (S+Q)'");
  const q = outPin(640, 120, "Q");
  const qn = outPin(640, 350, "Q'");
  comps.push(r, s, norQ, norQn, q, qn);
  conn(wires, r, "out", norQ, "in0");
  conn(wires, norQn, "out", norQ, "in1");
  conn(wires, norQ, "out", q, "in0");
  conn(wires, s, "out", norQn, "in0");
  conn(wires, norQ, "out", norQn, "in1");
  conn(wires, norQn, "out", qn, "in0");
  return { name: "Latch SR con NOR", components: comps, wires };
}

/** FF-D con clock: captura D en el flanco ascendente */
function buildFfd(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const d = inPin(80, 120, "D");
  const clk = mk("CLOCK", 80, 300, {}, "CLK");
  const ff = mk("FF_D", 360, 170, { edge: "rising", withAsync: false }, "FF-D");
  const q = outPin(640, 150, "Q");
  const qn = outPin(640, 270, "Q'");
  comps.push(d, clk, ff, q, qn);
  conn(wires, d, "out", ff, "d");
  conn(wires, clk, "out", ff, "clk");
  conn(wires, ff, "q", q, "in0");
  conn(wires, ff, "qn", qn, "in0");
  return { name: "Flip-Flop D con clock", components: comps, wires };
}

/** Contador ripple de 4 bits con FF-T: T=1 (POWER), Q de cada etapa → CLK de la siguiente */
function buildCounter4(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const pwr = mk("POWER", 60, 80, {}, "T = 1");
  const clk = mk("CLOCK", 80, 330, {}, "CLK");
  const ffs: ComponentInstance[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 320 + i * 220;
    const ff = mk("FF_T", x, 300, { edge: "rising" }, `FF-T${i}`);
    const q = outPin(x, 470, `Q${i}`);
    comps.push(ff, q);
    ffs.push(ff);
    conn(wires, pwr, "out", ff, "t");
    conn(wires, ff, "q", q, "in0");
    if (i === 0) conn(wires, clk, "out", ff, "clk");
    else conn(wires, ffs[i - 1], "q", ff, "clk");
  }
  comps.push(pwr, clk);
  return { name: "Contador 4 bits (FF-T)", components: comps, wires };
}

/** Divisor 100MHz → 12.5MHz: FREQ_DIVIDER con 3 etapas (÷2³ = ÷8) */
function buildDivider(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const clk = mk("CLOCK", 120, 170, {}, "CLK 100MHz");
  const fd = mk("FREQ_DIVIDER", 400, 150, { stages: 3 }, "÷2³");
  const out = outPin(680, 170, "12.5MHz");
  comps.push(clk, fd, out);
  conn(wires, clk, "out", fd, "clk");
  conn(wires, fd, "out", out, "in0");
  return { name: "Divisor 100MHz → 12.5MHz", components: comps, wires };
}

// ============================================================
// MÓDULO 4/5 — Registros, ALU y conversiones de FF
// ============================================================

/** Registro PIPO 8 bits: 8 pines → COMBINER → REG → SPLITTER → 8 LEDs */
function buildPipo8(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  for (let i = 0; i < 8; i++) {
    const di = inPin(60, 60 + i * 90, `D${i}`);
    comps.push(di);
    // se conecta al COMBINER cuando está creado (ver abajo)
    const qi = outPin(950, 60 + i * 90, `Q${i}`);
    comps.push(qi);
  }
  const comb = mk("COMBINER", 280, 220, { bits: 8 }, "bus D");
  const reg = mk("REG_PIPO", 520, 280, { bits: 8, delay: 1 }, "REG PIPO 8b");
  const load = inPin(340, 660, "LOAD");
  const clk = mk("CLOCK", 340, 770, {}, "CLK");
  const split = mk("SPLITTER", 760, 280, { bits: 8 }, "bus Q");
  comps.push(comb, reg, load, clk, split);
  const dPins = comps.filter((c) => c.type === "INPUT_PIN" && c.label?.startsWith("D"));
  const qPins = comps.filter((c) => c.type === "OUTPUT_PIN");
  for (let i = 0; i < 8; i++) {
    conn(wires, dPins[i], "out", comb, `b${i}`);
    conn(wires, split, `b${i}`, qPins[i], "in0");
  }
  conn(wires, comb, "bus", reg, "d");
  conn(wires, load, "out", reg, "load");
  conn(wires, clk, "out", reg, "clk");
  conn(wires, reg, "q", split, "bus");
  return { name: "Registro PIPO 8 bits", components: comps, wires };
}

/** ALU 8 bits: operandos fijos 0x0F y 0x03, OP de 3 bits, R en sonda hex + flags Z/N */
function buildAluDemo(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const ka = mk("CONSTANT", 80, 100, { bits: 8, value: 0x0f }, "K_A = 0x0F");
  const kb = mk("CONSTANT", 80, 250, { bits: 8, value: 0x03 }, "K_B = 0x03");
  const op0 = inPin(80, 470, "OP0 (LSB)");
  const op1 = inPin(80, 570, "OP1");
  const op2 = inPin(80, 670, "OP2 (MSB)");
  const alu = mk("ALU", 420, 300, { bits: 8, delay: 5 }, "ALU 8 bits");
  const probe = mk("PROBE", 740, 280, { format: "hex", probeWidth: 8 }, "R (hex)");
  const z = outPin(740, 470, "Z");
  const n = outPin(740, 590, "N");
  comps.push(ka, kb, op0, op1, op2, alu, probe, z, n);
  conn(wires, ka, "out", alu, "a");
  conn(wires, kb, "out", alu, "b");
  conn(wires, op0, "out", alu, "op0");
  conn(wires, op1, "out", alu, "op1");
  conn(wires, op2, "out", alu, "op2");
  conn(wires, alu, "out", probe, "in0");
  conn(wires, alu, "z", z, "in0");
  conn(wires, alu, "n", n, "in0");
  return { name: "ALU 8 bits con flags", components: comps, wires };
}

/** FF-JK a partir de FF-D: D = J·Q' + K'·Q con realimentación de Q y Q' */
function buildJkConversion(): CircuitData {
  const comps: ComponentInstance[] = [];
  const wires: Wire[] = [];
  const j = inPin(60, 70, "J");
  const k = inPin(60, 430, "K");
  const notK = mk("NOT", 260, 430, {}, "K'");
  const and1 = mk("AND", 260, 60, {}, "J·Q'");
  const and2 = mk("AND", 260, 250, {}, "K'·Q");
  const or = mk("OR", 470, 150, {}, "OR");
  const ff = mk("FF_D", 660, 140, { edge: "rising", withAsync: false }, "FF-D");
  const clk = mk("CLOCK", 660, 360, {}, "CLK");
  const q = outPin(900, 120, "Q");
  const qn = outPin(900, 240, "Q'");
  comps.push(j, k, notK, and1, and2, or, ff, clk, q, qn);
  conn(wires, j, "out", and1, "in0");
  conn(wires, ff, "qn", and1, "in1");
  conn(wires, k, "out", notK, "in0");
  conn(wires, notK, "out", and2, "in0");
  conn(wires, ff, "q", and2, "in1");
  conn(wires, and1, "out", or, "in0");
  conn(wires, and2, "out", or, "in1");
  conn(wires, or, "out", ff, "d");
  conn(wires, clk, "out", ff, "clk");
  conn(wires, ff, "q", q, "in0");
  conn(wires, ff, "qn", qn, "in0");
  return { name: "FF-JK desde FF-D (conversión)", components: comps, wires };
}

// ============================================================
// GALERÍA
// ============================================================

export const EXAMPLES: ExampleCircuit[] = [
  {
    id: "nand-not",
    name: "NOT con NAND",
    module: 1,
    description: "Inversor con una sola NAND: ambas entradas unidas al mismo pin. S = (A·A)' = A'.",
    build: buildNandNot,
  },
  {
    id: "nand-and",
    name: "AND con NAND",
    module: 1,
    description: "AND = NAND + inversor NAND: S = ((A·B)')'. Demostración de la universalidad de la NAND.",
    build: buildNandAnd,
  },
  {
    id: "nand-or",
    name: "OR con NOR (De Morgan)",
    module: 1,
    description: "De Morgan con NOR: S = A+B = NOR(NOR(A,B), NOR(A,B)). La otra compuerta universal.",
    build: buildNandOr,
  },
  {
    id: "mux21-gates",
    name: "MUX 2:1 con AND-OR",
    module: 1,
    description: "S = A·sel' + B·sel con NOT, 2 AND y OR. El multiplexor elemental con lógica de compuertas.",
    build: buildMux21Gates,
  },
  {
    id: "mux21-nand",
    name: "MUX 2:1 solo NAND",
    module: 1,
    description: "El clásico de final: MUX 2:1 con 4 NAND (incluye la NAND como inversor). S = A·sel' + B·sel.",
    build: buildMux21Nand,
  },
  {
    id: "dmux21",
    name: "DMUX 1:2 con compuertas",
    module: 1,
    description: "Demultiplexor 1:2: O0 = D·sel' y O1 = D·sel. El dato va a la salida que indica sel.",
    build: buildDmux21,
  },
  {
    id: "fa",
    name: "Full Adder (compuertas)",
    module: 1,
    description: "Sumador completo: Sum = A⊕B⊕Cin (2 XOR) y Cout = AB + ACin + BCin (3 AND + OR, función mayoría).",
    build: buildFa,
  },
  {
    id: "adder4",
    name: "Sumador Ripple 4 bits",
    module: 1,
    description: "4 Full Adders encadenados (cout→cin). En simulación cargá A y B y mirá Sum0-3 y Cout.",
    build: buildAdder4,
  },
  {
    id: "kmap-demo",
    name: "Karnaugh: F=Σm(0,2,4,6,8,9,10,11,15)",
    module: 2,
    description: "Función de 4 variables sintetizada automáticamente en AND-OR (Quine-McCluskey). Usá la pestaña Karnaugh para ver los agrupamientos y re-sintetizar.",
    build: buildKmapDemo,
  },
  {
    id: "lut-fa",
    name: "Sumador en FPGA (LUTs)",
    module: 2,
    description: "Full Adder con 2 LUTs de 3 entradas: tabla de Sum = A⊕B⊕Cin y tabla de Cout = mayoría. Cambiá A, B y Cin.",
    build: buildLutFa,
  },
  {
    id: "latch-sr",
    name: "Latch SR con NOR",
    module: 3,
    description: "Latch básico realimentado con 2 NOR cruzadas. Probá S=R=1 → estado prohibido (Q y Q' ambos en 0).",
    build: buildLatchSr,
  },
  {
    id: "ffd",
    name: "Flip-Flop D con clock",
    module: 3,
    description: "FF-D edge-triggered: captura D en el flanco ascendente del clock. Pasá a simulación, dá Play y cambiá D.",
    build: buildFfd,
  },
  {
    id: "counter4",
    name: "Contador 4 bits (FF-T)",
    module: 3,
    description: "Cadena de 4 FF-T con T=1: cada etapa divide la frecuencia por 2 y aporta un bit (Q0 = LSB). Q de cada FF cliquea el clock de la siguiente.",
    build: buildCounter4,
  },
  {
    id: "divider",
    name: "Divisor 100MHz → 12.5MHz",
    module: 3,
    description: "El clásico del final: 100/12.5 = 8 = 2³ → 3 etapas FF-T internas. Dá Play y compará CLK con OUT.",
    build: buildDivider,
  },
  {
    id: "pipo8",
    name: "Registro PIPO 8 bits",
    module: 4,
    description: "8 pines → COMBINER → REG_PIPO 8b (LOAD + CLK) → SPLITTER → 8 LEDs. Con LOAD=1 el bus D se captura en el flanco ascendente del clock.",
    build: buildPipo8,
  },
  {
    id: "alu-demo",
    name: "ALU 8 bits con flags",
    module: 5,
    description: "Operandos 0x0F y 0x03, OP de 3 bits: 000=ADD(0x12) · 001=SUB(0x0C) · 010=AND(0x03) · 011=OR(0x0F) · 100=XOR(0x0C) · 101=NOT A(0xF0) · 110=SHL(0x1E) · 111=SHR(0x07). Resultado en sonda hex + flags Z y N.",
    build: buildAluDemo,
  },
  {
    id: "jk-conversion",
    name: "FF-JK desde FF-D (conversión)",
    module: 5,
    description: "El clásico de final: FF-JK construido sobre FF-D con D = J·Q' + K'·Q (realimentación de Q y Q'). Probá J=K=1 → toggle.",
    build: buildJkConversion,
  },
];
