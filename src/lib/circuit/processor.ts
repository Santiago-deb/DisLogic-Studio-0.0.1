/* ============================================================
 * DisLogic — Módulo 5: Procesador didáctico de 8 bits (cátedra)
 * Arquitectura acumulador:
 *   PC (+incrementador, carga paralela) → RAM 256×8 → IR
 *   → Unidad de Control (decodifica opcode → señales)
 *   → Banco de Registros 8×8 (2 puertos lectura + 1 escritura)
 *   → ALU 8 bits (ADD SUB AND OR XOR NOT SHL SHR + flags Z C V N)
 *   → Acumulador (Acc).  MUX de origen de PC (+1 vs inmediato).
 *
 * Motor puro (sin React): step() ejecuta UN ciclo completo
 * fetch → decode → execute (modelo didáctico de cátedra).
 * ============================================================ */

export type Phase = "fetch" | "decode" | "execute";
export type MuxSel = "" | "alu" | "imm" | "reg";

export interface ProcessorState {
  pc: number; // 8 bits
  ir: number; // 8 bits (última instrucción fetchada)
  irValid: boolean; // false hasta el primer ciclo
  acc: number; // acumulador 8 bits
  regs: number[]; // banco 8×8
  ram: number[]; // 256×8
  z: number;
  c: number;
  v: number;
  n: number; // flags (0|1)
  halted: boolean;
  cycleCount: number;
  phase: Phase;
  lastInstruction: string;
  log: string[]; // últimos 50 ciclos, el más reciente primero: "PC=04 LOADI 0x05 → Acc=05"
  lastReg: number; // último registro involucrado (-1 si ninguno, para resaltar en el banco)
  progLen: number; // palabras escritas por el assembler
}

export interface ControlSignals {
  pcLoad: boolean; // carga paralela del PC (salto)
  pcInc: boolean; // habilita el incrementador +1
  irWrite: boolean; // escritura del IR
  regWrite: boolean; // escritura del banco de registros (Acc → Ri)
  memRead: boolean; // lectura de RAM
  memWrite: boolean; // escritura de RAM (sin instrucciones que la usen: siempre off)
  accWrite: boolean; // escritura del Acumulador
  aluOp: string; // "" | ADD | SUB | AND | OR | XOR | NOT | SHL | SHR
  muxSel: MuxSel; // origen del dato hacia Acc: ALU / inmediato / registro
  addrBus: number; // bus de direcciones hacia la RAM
  ramOut: number; // último dato leído de la RAM
  aluResult: number; // salida de la ALU en este ciclo
}

export interface AsmError {
  line: number;
  msg: string;
}

/* ---------------- ISA ----------------
 * Palabra de 8 bits: [7:4] opcode · [3:1] registro · [0] 0
 * LOADI / JMP / JZ ocupan 2 palabras: opcode+reg, luego byte inmediato.
 */
export const OP = {
  NOP: 0x0,
  LOAD: 0x1,
  STORE: 0x2,
  ADD: 0x3,
  SUB: 0x4,
  AND: 0x5,
  OR: 0x6,
  XOR: 0x7,
  NOT: 0x8,
  SHL: 0x9,
  SHR: 0xa,
  LOADI: 0xb,
  JMP: 0xc,
  JZ: 0xd,
  HALT: 0xe,
} as const;

const OP_NAMES: Record<number, string> = {
  0x0: "NOP",
  0x1: "LOAD",
  0x2: "STORE",
  0x3: "ADD",
  0x4: "SUB",
  0x5: "AND",
  0x6: "OR",
  0x7: "XOR",
  0x8: "NOT",
  0x9: "SHL",
  0xa: "SHR",
  0xb: "LOADI",
  0xc: "JMP",
  0xd: "JZ",
  0xe: "HALT",
};

/** Instrucciones de 2 palabras (opcode + inmediato). */
export const TWO_WORD_OPS: Set<number> = new Set([OP.LOADI, OP.JMP, OP.JZ]);
/** Operaciones de la ALU que leen un registro como operando B. */
export const REG_ALU_OPS: Set<string> = new Set(["ADD", "SUB", "AND", "OR", "XOR"]);

/** Byte → 2 dígitos hex mayúsculas. */
export function h2(n: number): string {
  return (n & 0xff).toString(16).padStart(2, "0").toUpperCase();
}

/** Decodifica un byte a texto de instrucción (para el IR y la CU). */
export function decodeByte(b: number): string {
  const op = (b >> 4) & 0xf;
  const reg = (b >> 1) & 0x7;
  const name = OP_NAMES[op];
  if (!name) return `0x${h2(b)} inválido`;
  if (op === OP.LOADI) return "LOADI +imm";
  if (op === OP.JMP) return "JMP +imm";
  if (op === OP.JZ) return "JZ +imm";
  if (REG_ALU_OPS.has(name) || op === OP.LOAD || op === OP.STORE) return `${name} R${reg}`;
  return name;
}

/* ---------------- Análisis temporal (referencias de la cátedra) ---------------- */

export const REF_DELAYS: { name: string; ns: number }[] = [
  { name: "t_ram", ns: 4 },
  { name: "t_mux2_8", ns: 2 },
  { name: "t_dmux2_1", ns: 2 },
  { name: "t_cu", ns: 3 },
  { name: "t_add_8bits", ns: 5 },
  { name: "t_sub_8bits", ns: 5 },
  { name: "t_compuertas_8bits", ns: 1 },
  { name: "t_shift", ns: 0.5 },
  { name: "t_buffers", ns: 1 },
  { name: "t_setup", ns: 0.25 },
  { name: "t_prop", ns: 0.75 },
  { name: "t_hold", ns: 0.01 },
];

/** Camino crítico: T_min = t_prop + t_ram + t_cu + t_mux + t_ALU + t_setup */
export const TIMING_TERMS: { name: string; value: number }[] = [
  { name: "t_prop", value: 0.75 },
  { name: "t_ram", value: 4 },
  { name: "t_cu", value: 3 },
  { name: "t_mux2_8", value: 2 },
  { name: "t_add_8bits", value: 5 },
  { name: "t_setup", value: 0.25 },
];

export const T_MIN_NS = TIMING_TERMS.reduce((acc, t) => acc + t.value, 0); // ≈ 15 ns
export const F_MAX_MHZ = 1000 / T_MIN_NS; // ≈ 66.7 MHz

/* ---------------- Assembler ---------------- */

type MnemKind = "none" | "reg" | "imm" | "target";
interface MnemDef {
  op: number;
  size: 1 | 2;
  kind: MnemKind;
}

const MNEMONICS: Record<string, MnemDef> = {
  NOP: { op: OP.NOP, size: 1, kind: "none" },
  LOAD: { op: OP.LOAD, size: 1, kind: "reg" },
  STORE: { op: OP.STORE, size: 1, kind: "reg" },
  ADD: { op: OP.ADD, size: 1, kind: "reg" },
  SUB: { op: OP.SUB, size: 1, kind: "reg" },
  AND: { op: OP.AND, size: 1, kind: "reg" },
  OR: { op: OP.OR, size: 1, kind: "reg" },
  XOR: { op: OP.XOR, size: 1, kind: "reg" },
  NOT: { op: OP.NOT, size: 1, kind: "none" },
  SHL: { op: OP.SHL, size: 1, kind: "none" },
  SHR: { op: OP.SHR, size: 1, kind: "none" },
  LOADI: { op: OP.LOADI, size: 2, kind: "imm" },
  JMP: { op: OP.JMP, size: 2, kind: "target" },
  JZ: { op: OP.JZ, size: 2, kind: "target" },
  HALT: { op: OP.HALT, size: 1, kind: "none" },
};

const REG_RE = /^[Rr]([0-7])$/;
const LABEL_DEF_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/;

/** Quita comentarios (`;` o `#`). */
function stripComment(text: string): string {
  const i1 = text.indexOf(";");
  const i2 = text.indexOf("#");
  let i = -1;
  if (i1 >= 0 && i2 >= 0) i = Math.min(i1, i2);
  else i = Math.max(i1, i2);
  return i >= 0 ? text.slice(0, i) : text;
}

/** Número: 0x.. hex · 0b.. binario · decimal. Fuera de eso → null. */
function parseValue(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (/^0x[0-9a-f]{1,2}$/.test(t)) return parseInt(t.slice(2), 16);
  if (/^0b[01]{1,8}$/.test(t)) return parseInt(t.slice(2), 2);
  if (/^\d{1,3}$/.test(t)) {
    const v = parseInt(t, 10);
    return v <= 255 ? v : null;
  }
  return null;
}

/* ============================================================
 * Procesador
 * ============================================================ */

export class Processor {
  state: ProcessorState;
  private sig: ControlSignals;

  constructor() {
    this.state = {
      pc: 0,
      ir: 0,
      irValid: false,
      acc: 0,
      regs: Array<number>(8).fill(0),
      ram: Array<number>(256).fill(0),
      z: 0,
      c: 0,
      v: 0,
      n: 0,
      halted: false,
      cycleCount: 0,
      phase: "fetch",
      lastInstruction: "—",
      log: [],
      lastReg: -1,
      progLen: 0,
    };
    this.sig = this.idleSignals();
  }

  private idleSignals(): ControlSignals {
    return {
      pcLoad: false,
      pcInc: false,
      irWrite: false,
      regWrite: false,
      memRead: false,
      memWrite: false,
      accWrite: false,
      aluOp: "",
      muxSel: "",
      addrBus: this.state.pc,
      ramOut: this.state.ram[this.state.pc] ?? 0,
      aluResult: 0,
    };
  }

  /** Señales de control del último ciclo ejecutado (para pintar el datapath). */
  getSignals(): ControlSignals {
    return this.sig;
  }

  /** Reinicia la CPU (PC, IR, Acc, registros, flags, log). Conserva RAM y programa. */
  reset(): void {
    const s = this.state;
    s.pc = 0;
    s.ir = 0;
    s.irValid = false;
    s.acc = 0;
    s.regs = Array<number>(8).fill(0);
    s.z = 0;
    s.c = 0;
    s.v = 0;
    s.n = 0;
    s.halted = false;
    s.cycleCount = 0;
    s.phase = "fetch";
    s.lastInstruction = "—";
    s.log = [];
    s.lastReg = -1;
    this.sig = this.idleSignals();
  }

  /** Edición manual de la RAM desde la grilla hex. */
  setRam(addr: number, value: number): void {
    const a = addr & 0xff;
    const v = value & 0xff;
    this.state.ram[a] = v;
    if (this.sig.addrBus === a) this.sig.ramOut = v;
  }

  /**
   * Ensambla un programa a RAM (dos pasadas: etiquetas + codificación).
   * Con errores no toca la RAM. Si está OK, resetea la CPU con PC=0.
   */
  loadProgram(asm: string): { ok: boolean; errors: AsmError[]; bytes: number } {
    const errors: AsmError[] = [];
    const lines = asm.split(/\r?\n/);

    // ---- pasada 1: comentarios, etiquetas, direcciones ----
    interface Item {
      line: number;
      mnem: string;
      operand: string | null;
    }
    const items: Item[] = [];
    const labels = new Map<string, number>();
    let addr = 0;

    lines.forEach((raw, i) => {
      const lineNo = i + 1;
      let text = stripComment(raw).trim();
      // puede haber más de una etiqueta por línea ("a: b: NOP")
      for (;;) {
        const m = text.match(LABEL_DEF_RE);
        if (!m) break;
        const key = m[1].toLowerCase();
        if (labels.has(key)) errors.push({ line: lineNo, msg: `etiqueta duplicada "${m[1]}"` });
        else labels.set(key, addr);
        text = text.slice(m[0].length).trim();
      }
      if (!text) return;
      const sp = text.search(/\s/);
      const mnem = (sp < 0 ? text : text.slice(0, sp)).toUpperCase();
      const operand = sp < 0 ? null : text.slice(sp + 1).trim() || null;
      const def = MNEMONICS[mnem];
      if (!def) {
        errors.push({ line: lineNo, msg: `instrucción desconocida "${mnem}"` });
        return;
      }
      if (addr + def.size > 256) {
        errors.push({ line: lineNo, msg: "el programa excede las 256 palabras de la RAM" });
        return;
      }
      items.push({ line: lineNo, mnem, operand });
      addr += def.size;
    });

    // ---- pasada 2: codificación ----
    const words: number[] = [];
    for (const it of items) {
      const def = MNEMONICS[it.mnem];
      let reg = 0;
      let imm = 0;
      if (def.kind === "reg") {
        if (!it.operand) {
          errors.push({ line: it.line, msg: `${it.mnem} requiere un registro R0..R7` });
          continue;
        }
        const rm = it.operand.match(REG_RE);
        if (!rm) {
          errors.push({ line: it.line, msg: `registro inválido "${it.operand}" (usá R0..R7)` });
          continue;
        }
        reg = Number(rm[1]);
      } else if (def.kind === "imm" || def.kind === "target") {
        if (!it.operand) {
          errors.push({
            line: it.line,
            msg: `${it.mnem} requiere un operando (${def.kind === "imm" ? "valor 0..255" : "etiqueta o dirección 0..255"})`,
          });
          continue;
        }
        const key = it.operand.toLowerCase();
        const labelAddr = def.kind === "target" && !/^[0-9]/.test(it.operand) ? labels.get(key) : undefined;
        if (labelAddr !== undefined) {
          imm = labelAddr;
        } else {
          const v = parseValue(it.operand);
          if (v === null) {
            errors.push({
              line: it.line,
              msg:
                def.kind === "target"
                  ? `destino inválido "${it.operand}" (etiqueta inexistente o número fuera de rango)`
                  : `valor inválido "${it.operand}" (usá 0..255, admite hex 0x..)`,
            });
            continue;
          }
          imm = v;
        }
      }
      words.push(((def.op << 4) | (reg << 1)) & 0xff); // [7:4] opcode · [3:1] reg
      if (def.size === 2) words.push(imm & 0xff);
    }

    if (errors.length > 0) return { ok: false, errors, bytes: 0 };

    // ---- escribir RAM + resetear CPU ----
    const s = this.state;
    s.ram = Array<number>(256).fill(0);
    words.forEach((w, i) => {
      s.ram[i] = w;
    });
    s.progLen = words.length;
    this.reset();
    return { ok: true, errors: [], bytes: words.length };
  }

  /** Ejecuta UN ciclo completo: fetch → decode → execute (modelo didáctico). */
  step(): void {
    const s = this.state;
    if (s.halted) return;
    const sig = this.sig;
    s.cycleCount++;
    s.phase = "fetch";

    // ---------- FETCH ----------
    const pc0 = s.pc & 0xff;
    const opcode = s.ram[pc0] ?? 0;
    sig.pcLoad = false;
    sig.pcInc = false;
    sig.irWrite = false;
    sig.regWrite = false;
    sig.memRead = false;
    sig.memWrite = false;
    sig.accWrite = false;
    sig.aluOp = "";
    sig.muxSel = "";
    sig.aluResult = 0;
    sig.addrBus = pc0;
    sig.ramOut = opcode;
    sig.memRead = true;
    sig.irWrite = true;
    s.ir = opcode;
    s.irValid = true;

    // ---------- DECODE ----------
    s.phase = "decode";
    const op = (opcode >> 4) & 0xf;
    const reg = (opcode >> 1) & 0x7; // bits [3:1]
    const twoWord = TWO_WORD_OPS.has(op);
    const immAddr = (pc0 + 1) & 0xff;
    const imm = twoWord ? (s.ram[immAddr] ?? 0) : 0;
    s.lastReg = -1;

    const writeAcc = (val: number, c = 0, v = 0): void => {
      const r = val & 0xff;
      s.acc = r;
      s.z = r === 0 ? 1 : 0;
      s.n = (r >> 7) & 1;
      s.c = c;
      s.v = v;
      sig.accWrite = true;
    };
    const advance = (delta: number): void => {
      sig.pcInc = true;
      s.pc = (pc0 + delta) & 0xff;
    };
    const jumpTo = (target: number): void => {
      sig.pcLoad = true;
      s.pc = target & 0xff;
    };
    const readImm = (): void => {
      sig.addrBus = immAddr;
      sig.ramOut = imm;
    };

    // ---------- EXECUTE ----------
    s.phase = "execute";
    switch (op) {
      case OP.NOP:
        s.lastInstruction = "NOP";
        advance(1);
        break;

      case OP.LOAD: {
        const v = s.regs[reg] ?? 0;
        s.lastReg = reg;
        s.lastInstruction = `LOAD R${reg} → Acc=${h2(v)}`;
        sig.muxSel = "reg";
        writeAcc(v);
        advance(1);
        break;
      }

      case OP.STORE:
        s.lastReg = reg;
        sig.regWrite = true;
        s.regs[reg] = s.acc;
        s.lastInstruction = `STORE R${reg} ← Acc=${h2(s.acc)}`;
        advance(1);
        break;

      case OP.ADD:
      case OP.SUB: {
        const a = s.acc;
        const b = s.regs[reg] ?? 0;
        const isAdd = op === OP.ADD;
        const raw = isAdd ? a + b : a - b;
        const r = raw & 0xff;
        const c = isAdd ? (raw > 0xff ? 1 : 0) : a < b ? 1 : 0; // ADD: carry · SUB: borrow
        const v = isAdd
          ? ((a ^ r) & (b ^ r) & 0x80) !== 0
            ? 1
            : 0
          : ((a ^ b) & (a ^ r) & 0x80) !== 0
            ? 1
            : 0;
        const name = isAdd ? "ADD" : "SUB";
        s.lastReg = reg;
        s.lastInstruction = `${name} R${reg} → Acc=${h2(r)}`;
        sig.aluOp = name;
        sig.aluResult = r;
        sig.muxSel = "alu";
        writeAcc(r, c, v);
        advance(1);
        break;
      }

      case OP.AND:
      case OP.OR:
      case OP.XOR: {
        const a = s.acc;
        const b = s.regs[reg] ?? 0;
        const r = op === OP.AND ? a & b : op === OP.OR ? a | b : a ^ b;
        const name = op === OP.AND ? "AND" : op === OP.OR ? "OR" : "XOR";
        s.lastReg = reg;
        s.lastInstruction = `${name} R${reg} → Acc=${h2(r)}`;
        sig.aluOp = name;
        sig.aluResult = r & 0xff;
        sig.muxSel = "alu";
        writeAcc(r, 0, 0);
        advance(1);
        break;
      }

      case OP.NOT: {
        const r = ~s.acc & 0xff;
        s.lastInstruction = `NOT → Acc=${h2(r)}`;
        sig.aluOp = "NOT";
        sig.aluResult = r;
        sig.muxSel = "alu";
        writeAcc(r, 0, 0);
        advance(1);
        break;
      }

      case OP.SHL: {
        const c = (s.acc >> 7) & 1; // bit saliente
        const r = (s.acc << 1) & 0xff;
        s.lastInstruction = `SHL → Acc=${h2(r)} (C=${c})`;
        sig.aluOp = "SHL";
        sig.aluResult = r;
        sig.muxSel = "alu";
        writeAcc(r, c, 0);
        advance(1);
        break;
      }

      case OP.SHR: {
        const c = s.acc & 1; // bit saliente
        const r = s.acc >> 1;
        s.lastInstruction = `SHR → Acc=${h2(r)} (C=${c})`;
        sig.aluOp = "SHR";
        sig.aluResult = r;
        sig.muxSel = "alu";
        writeAcc(r, c, 0);
        advance(1);
        break;
      }

      case OP.LOADI:
        readImm();
        s.lastInstruction = `LOADI 0x${h2(imm)} → Acc=${h2(imm)}`;
        sig.muxSel = "imm";
        writeAcc(imm, 0, 0);
        advance(2); // opcode + inmediato
        break;

      case OP.JMP:
        readImm();
        s.lastInstruction = `JMP → PC=0x${h2(imm)}`;
        jumpTo(imm);
        break;

      case OP.JZ:
        readImm();
        if (s.z === 1) {
          // flag Z del ciclo anterior
          s.lastInstruction = `JZ 0x${h2(imm)} (Z=1) → PC=0x${h2(imm)}`;
          jumpTo(imm);
        } else {
          s.lastInstruction = `JZ 0x${h2(imm)} (Z=0) → sigue`;
          advance(2);
        }
        break;

      case OP.HALT:
        s.lastInstruction = "HALT ■";
        s.halted = true;
        break; // el PC queda apuntando al HALT

      default:
        // opcode 0xF (o cualquier nibble no definido): detener
        s.lastInstruction = `0x${h2(opcode)} = opcode inválido`;
        s.halted = true;
        break;
    }

    // log (el más reciente primero, tope 50)
    s.log = [`PC=${h2(pc0)} ${s.lastInstruction}`, ...s.log].slice(0, 50);
  }
}
