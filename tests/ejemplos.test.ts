// Verificación de la galería de ejemplos DisLogic — corre con bun (temporal, fuera del build)
import { Simulator } from "../src/lib/circuit/simulator";
import { EXAMPLES } from "../src/lib/circuit/examples";
import type { CircuitData, ComponentInstance } from "../src/lib/circuit/types";

const sim = new Simulator();
let fails = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name} ${detail}`); fails++; }
};

function load(id: string): CircuitData {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const data = ex.build();
  sim.rebuild(data);
  const stable = sim.run();
  ok(`${id}: build + sim estable (sin oscilación)`, stable);
  return data;
}

const comp = (d: CircuitData, label: string, type?: string): ComponentInstance => {
  const c = d.components.find((c) => c.label === label && (!type || c.type === type));
  if (!c) throw new Error(`no comp "${label}" (${type ?? "*"}) en "${d.name}"`);
  return c;
};
const setIn = (d: CircuitData, label: string, v: number) => {
  sim.setComponentState(comp(d, label, "INPUT_PIN").id, "value", v);
  sim.run();
};
const outV = (d: CircuitData, label: string): number => {
  const c = comp(d, label, "OUTPUT_PIN");
  const v = sim.pinValues()[`${c.id}:in0`];
  return v === undefined ? -1 : v;
};
const pinV = (d: CircuitData, id: string, pin: string): number => {
  const v = sim.pinValues()[`${id}:${pin}`];
  return v === undefined ? -1 : v;
};
const pulse = (d: CircuitData, label = "CLK") => {
  const c = comp(d, label, "CLOCK");
  sim.toggleClock(c.id); sim.run();
  sim.toggleClock(c.id); sim.run();
};
const inputPinsByY = (d: CircuitData): ComponentInstance[] =>
  d.components.filter((c) => c.type === "INPUT_PIN").sort((a, b) => a.y - b.y);

console.log("\n=== nand-not ===");
{
  const d = load("nand-not");
  setIn(d, "A", 0); ok("A=0 → S=1", outV(d, "S = A'") === 1);
  setIn(d, "A", 1); ok("A=1 → S=0", outV(d, "S = A'") === 0);
}

console.log("\n=== nand-and ===");
{
  const d = load("nand-and");
  setIn(d, "A", 0); setIn(d, "B", 0); ok("00 → 0", outV(d, "S = A·B") === 0);
  setIn(d, "A", 1); setIn(d, "B", 0); ok("10 → 0", outV(d, "S = A·B") === 0);
  setIn(d, "A", 1); setIn(d, "B", 1); ok("11 → 1", outV(d, "S = A·B") === 1);
}

console.log("\n=== nand-or ===");
{
  const d = load("nand-or");
  setIn(d, "A", 0); setIn(d, "B", 0); ok("00 → 0", outV(d, "S = A+B") === 0);
  setIn(d, "A", 0); setIn(d, "B", 1); ok("01 → 1", outV(d, "S = A+B") === 1);
  setIn(d, "A", 1); setIn(d, "B", 1); ok("11 → 1", outV(d, "S = A+B") === 1);
}

console.log("\n=== mux21-gates ===");
{
  const d = load("mux21-gates");
  setIn(d, "A", 1); setIn(d, "B", 0); setIn(d, "sel", 0); ok("A=1,B=0,sel=0 → 1", outV(d, "S") === 1);
  setIn(d, "sel", 1); ok("sel=1 → 0 (B)", outV(d, "S") === 0);
  setIn(d, "A", 0); setIn(d, "B", 1); ok("A=0,B=1,sel=1 → 1", outV(d, "S") === 1);
  setIn(d, "sel", 0); ok("sel=0 → 0 (A)", outV(d, "S") === 0);
}

console.log("\n=== mux21-nand ===");
{
  const d = load("mux21-nand");
  setIn(d, "A", 1); setIn(d, "B", 0); setIn(d, "sel", 0); ok("A=1,B=0,sel=0 → 1", outV(d, "S") === 1);
  setIn(d, "sel", 1); ok("sel=1 → 0 (B)", outV(d, "S") === 0);
  setIn(d, "A", 0); setIn(d, "B", 1); ok("A=0,B=1,sel=1 → 1", outV(d, "S") === 1);
  setIn(d, "sel", 0); ok("sel=0 → 0 (A)", outV(d, "S") === 0);
}

console.log("\n=== dmux21 ===");
{
  const d = load("dmux21");
  setIn(d, "D", 1); setIn(d, "sel", 0);
  ok("D=1,sel=0 → O0=1", outV(d, "O0") === 1); ok("D=1,sel=0 → O1=0", outV(d, "O1") === 0);
  setIn(d, "sel", 1);
  ok("D=1,sel=1 → O0=0", outV(d, "O0") === 0); ok("D=1,sel=1 → O1=1", outV(d, "O1") === 1);
  setIn(d, "D", 0);
  ok("D=0,sel=1 → O1=0", outV(d, "O1") === 0);
}

console.log("\n=== fa (compuertas) ===");
{
  const d = load("fa");
  let allOk = true;
  for (let m = 0; m < 8; m++) {
    const a = (m >> 2) & 1, b = (m >> 1) & 1, c = m & 1;
    setIn(d, "A", a); setIn(d, "B", b); setIn(d, "Cin", c);
    const sum = outV(d, "Sum"), cout = outV(d, "Cout");
    const es = a ^ b ^ c, ec = (a & b) | (a & c) | (b & c);
    if (sum !== es || cout !== ec) { allOk = false; console.log(`    caso ${a}${b}${c}: got sum=${sum} cout=${cout} esperado ${es}/${ec}`); }
  }
  ok("tabla completa de 8 casos Sum/Cout", allOk);
}

console.log("\n=== adder4 ===");
{
  const d = load("adder4");
  const setBus = (pfx: string, v: number) => { for (let i = 0; i < 4; i++) setIn(d, `${pfx}${i}`, (v >> i) & 1); };
  const readSum = () => outV(d, "Sum0") | (outV(d, "Sum1") << 1) | (outV(d, "Sum2") << 2) | (outV(d, "Sum3") << 3);
  setBus("A", 5); setBus("B", 3); setIn(d, "Cin", 0);
  ok("5+3 = 8, Cout=0", readSum() === 8 && outV(d, "Cout") === 0, `got ${readSum()}, C=${outV(d, "Cout")}`);
  setBus("A", 15); setBus("B", 1);
  ok("15+1 = 0, Cout=1", readSum() === 0 && outV(d, "Cout") === 1, `got ${readSum()}, C=${outV(d, "Cout")}`);
  setBus("A", 9); setBus("B", 8); setIn(d, "Cin", 1);
  ok("9+8+1 = 2, Cout=1", readSum() === 2 && outV(d, "Cout") === 1, `got ${readSum()}, C=${outV(d, "Cout")}`);
}

console.log("\n=== kmap-demo ===");
{
  const d = load("kmap-demo");
  console.log(`  nombre: "${d.name}"`);
  const mins = [0, 2, 4, 6, 8, 9, 10, 11, 15];
  const ins = inputPinsByY(d); // A (MSB) ... D (LSB)
  ok("4 variables de entrada", ins.length === 4);
  const outComp = d.components.find((c) => c.type === "OUTPUT_PIN")!;
  let allOk = true;
  for (let v = 0; v < 16; v++) {
    for (let i = 0; i < 4; i++) sim.setComponentState(ins[i].id, "value", (v >> (3 - i)) & 1);
    sim.run();
    const f = pinV(d, outComp.id, "in0");
    const expected = mins.includes(v) ? 1 : 0;
    if (f !== expected) { allOk = false; console.log(`    m=${v}: F=${f} esperado ${expected}`); }
  }
  ok("F=1 exactamente en Σm(0,2,4,6,8,9,10,11,15)", allOk);
}

console.log("\n=== lut-fa ===");
{
  const d = load("lut-fa");
  let allOk = true;
  for (let m = 0; m < 8; m++) {
    const a = (m >> 2) & 1, b = (m >> 1) & 1, c = m & 1;
    setIn(d, "A", a); setIn(d, "B", b); setIn(d, "Cin", c);
    const sum = outV(d, "Sum"), cout = outV(d, "Cout");
    if (sum !== (a ^ b ^ c) || cout !== ((a & b) | (a & c) | (b & c))) { allOk = false; console.log(`    caso ${a}${b}${c}: sum=${sum} cout=${cout}`); }
  }
  ok("LUTs reproducen Sum y Cout en 8 casos", allOk);
}

console.log("\n=== latch-sr ===");
{
  const d = load("latch-sr");
  setIn(d, "S", 1); setIn(d, "R", 0);
  ok("S=1,R=0 → Q=1", outV(d, "Q") === 1); ok("S=1,R=0 → Q'=0", outV(d, "Q'") === 0);
  setIn(d, "S", 0);
  ok("S=0,R=0 → mantiene Q=1", outV(d, "Q") === 1);
  setIn(d, "R", 1);
  ok("S=0,R=1 → Q=0", outV(d, "Q") === 0); ok("S=0,R=1 → Q'=1", outV(d, "Q'") === 1);
  setIn(d, "S", 1);
  ok("S=1,R=1 prohibido → Q=0 y Q'=0", outV(d, "Q") === 0 && outV(d, "Q'") === 0);
}

console.log("\n=== ffd ===");
{
  const d = load("ffd");
  setIn(d, "D", 1); pulse(d);
  ok("D=1, pulso → Q=1", outV(d, "Q") === 1 && outV(d, "Q'") === 0);
  setIn(d, "D", 0); pulse(d);
  ok("D=0, pulso → Q=0", outV(d, "Q") === 0 && outV(d, "Q'") === 1);
  setIn(d, "D", 1); // sin pulso no captura
  ok("sin flanco no captura", outV(d, "Q") === 0);
}

console.log("\n=== counter4 ===");
{
  const d = load("counter4");
  const val = () => outV(d, "Q0") | (outV(d, "Q1") << 1) | (outV(d, "Q2") << 2) | (outV(d, "Q3") << 3);
  pulse(d); ok("pulso 1 → 15", val() === 15, `got ${val()}`);
  pulse(d); ok("pulso 2 → 14 (divide por 2 por etapa)", val() === 14, `got ${val()}`);
  pulse(d); pulse(d); ok("pulso 4 → 12", val() === 12, `got ${val()}`);
  for (let i = 0; i < 12; i++) pulse(d);
  ok("pulso 16 → 0 (módulo 16)", val() === 0, `got ${val()}`);
}

console.log("\n=== divider ===");
{
  const d = load("divider");
  const outComp = d.components.find((c) => c.type === "OUTPUT_PIN")!;
  const o = () => pinV(d, outComp.id, "in0");
  const clkComp = d.components.find((c) => c.type === "CLOCK")!;
  const pulseDiv = () => { sim.toggleClock(clkComp.id); sim.run(); sim.toggleClock(clkComp.id); sim.run(); };
  for (let i = 0; i < 4; i++) pulseDiv();
  ok("4 pulsos (÷8): OUT=1", o() === 1, `got ${o()}`);
  for (let i = 0; i < 4; i++) pulseDiv();
  ok("8 pulsos: OUT=0", o() === 0, `got ${o()}`);
}

console.log("\n=== pipo8 ===");
{
  const d = load("pipo8");
  const word = 0b10100101; // 0xA5
  for (let i = 0; i < 8; i++) setIn(d, `D${i}`, (word >> i) & 1);
  setIn(d, "LOAD", 1); pulse(d);
  let read = 0;
  for (let i = 0; i < 8; i++) read |= outV(d, `Q${i}`) << i;
  ok("carga 0xA5 con LOAD=1", read === word, `got ${read.toString(2)}`);
  for (let i = 0; i < 8; i++) setIn(d, `D${i}`, 1);
  setIn(d, "LOAD", 0); pulse(d);
  read = 0;
  for (let i = 0; i < 8; i++) read |= outV(d, `Q${i}`) << i;
  ok("LOAD=0 retiene", read === word, `got ${read.toString(2)}`);
}

console.log("\n=== alu-demo ===");
{
  const d = load("alu-demo");
  const probe = comp(d, "R (hex)", "PROBE");
  const r = () => pinV(d, probe.id, "in0");
  const cases: [number, number, number, number][] = [
    [0, 0x12, 0, 0], [1, 0x0c, 0, 0], [2, 0x03, 0, 0], [3, 0x0f, 0, 0],
    [4, 0x0c, 0, 0], [5, 0xf0, 0, 1], [6, 0x1e, 0, 0], [7, 0x07, 0, 0],
  ];
  let allOk = true;
  for (const [op, er, ez, en] of cases) {
    setIn(d, "OP0 (LSB)", op & 1); setIn(d, "OP1", (op >> 1) & 1); setIn(d, "OP2 (MSB)", (op >> 2) & 1);
    const got = [r(), outV(d, "Z"), outV(d, "N")];
    if (got[0] !== er || got[1] !== ez || got[2] !== en) { allOk = false; console.log(`    OP=${op}: got R=${got[0].toString(16)} Z=${got[1]} N=${got[2]} esperado ${er.toString(16)}/${ez}/${en}`); }
  }
  ok("8 operaciones con flags Z/N", allOk);
}

console.log("\n=== jk-conversion ===");
{
  const d = load("jk-conversion");
  setIn(d, "J", 1); setIn(d, "K", 0); pulse(d);
  ok("J=1,K=0 → Q=1 (set)", outV(d, "Q") === 1);
  setIn(d, "J", 0); setIn(d, "K", 0); pulse(d);
  ok("J=0,K=0 → mantiene 1", outV(d, "Q") === 1);
  setIn(d, "J", 0); setIn(d, "K", 1); pulse(d);
  ok("J=0,K=1 → Q=0 (reset)", outV(d, "Q") === 0);
  setIn(d, "J", 1); setIn(d, "K", 1); pulse(d);
  ok("J=1,K=1 → toggle a 1", outV(d, "Q") === 1);
  pulse(d);
  ok("J=1,K=1 → toggle a 0", outV(d, "Q") === 0);
}

console.log("\n=== unicidad de ids entre invocaciones ===");
{
  const ex = EXAMPLES.find((e) => e.id === "fa")!;
  const a = ex.build(), b = ex.build();
  const idsA = new Set(a.components.map((c) => c.id));
  const clash = b.components.some((c) => idsA.has(c.id));
  ok("dos build() no comparten ids", !clash);
  const dup = new Set(a.components.map((c) => c.id)).size !== a.components.length;
  ok("sin ids duplicados dentro de un circuito", !dup);
  const idsW = new Set<string>();
  let wireDup = false;
  for (const w of [...a.wires, ...b.wires]) { if (idsW.has(w.id)) wireDup = true; idsW.add(w.id); }
  ok("sin ids de cable duplicados", !wireDup);
}

console.log(`\n${fails === 0 ? "TODOS LOS TESTS PASARON ✔" : `${fails} TESTS FALLARON ✘`}`);
process.exit(fails === 0 ? 0 : 1);
