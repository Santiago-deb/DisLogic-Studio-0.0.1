// ============================================================
// DisLogic — Minimización lógica: Quine-McCluskey + Mapa de Karnaugh
// Soporta 2 a 4 variables, don't cares, salida SOP y POS.
// ============================================================

export interface Implicant {
  /** máscara de bits fijos (1 = bit relevante) */
  mask: number;
  /** valor de los bits fijos */
  value: number;
  /** mintérminos cubiertos */
  covered: number[];
  /** ¿contiene don't cares? */
  hasDC: boolean;
}

export interface KGroup {
  /** término producto: para cada variable: 1, 0, o -1 (eliminada) */
  literals: number[];
  /** mintérminos cubiertos (solo los 1s) */
  minterms: number[];
  color: string;
  label: string; // ej: "A·B'"
}

export interface KResult {
  sop: string;           // "A·B' + C"
  pos: string;           // "(A+B)·(C')"
  sopTerms: number[][];  // literals por término (1, 0, -1)
  posTerms: number[][];
  groups: KGroup[];      // para dibujar agrupamientos
  primeCount: number;
  essentialCount: number;
}

const GROUP_COLORS = [
  "#2F7FD6", "#D9731A", "#2E9E5B", "#B548C6", "#C0392B", "#1D9AA6", "#8A6D1F", "#6A5ACD",
];

export const VAR_NAMES_4 = ["A", "B", "C", "D"];

function popcount(x: number): number {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}

/** dos implicants pueden combinarse si difieren en exactamente 1 bit (con misma máscara) */
function combine(a: Implicant, b: Implicant): Implicant | null {
  if (a.mask !== b.mask) return null;
  const diff = (a.value ^ b.value) & a.mask;
  if (popcount(diff) !== 1) return null;
  const newMask = a.mask & ~diff;
  const newValue = a.value & newMask;
  const covered = Array.from(new Set([...a.covered, ...b.covered])).sort((x, y) => x - y);
  return { mask: newMask, value: newValue, covered, hasDC: a.hasDC || b.hasDC };
}

function termLabel(literals: number[], names: string[], mode: "sop" | "pos"): string {
  const parts: string[] = [];
  for (let i = 0; i < literals.length; i++) {
    const lit = literals[i];
    if (lit === -1) continue;
    const name = names[i] ?? `V${i}`;
    if (mode === "sop") parts.push(lit === 1 ? name : `${name}'`);
    else parts.push(lit === 1 ? name : `${name}'`);
  }
  if (parts.length === 0) return mode === "sop" ? "1" : "0";
  return mode === "sop" ? parts.join("·") : parts.join("+");
}

function wrapPos(term: string): string {
  return term.includes("+") ? `(${term})` : term;
}

/**
 * Minimización Quine-McCluskey con selección de implicantes primos esenciales.
 * @param minterms lista de mintérminos donde F=1
 * @param dontcares condiciones indiferentes
 * @param nVars cantidad de variables (2-4)
 * @param varNames nombres de variables
 */
export function minimize(
  minterms: number[],
  dontcares: number[],
  nVars: number,
  varNames: string[] = VAR_NAMES_4.slice(0, nVars),
): KResult {
  const total = 1 << nVars;
  const valid = (v: number) => v >= 0 && v < total;
  const ones = [...new Set(minterms.filter(valid))];
  const dcs = [...new Set(dontcares.filter(valid))].filter((v) => !ones.includes(v));
  const fullMask = total - 1;

  if (ones.length === 0) {
    return { sop: "0", pos: "0", sopTerms: [], posTerms: [], groups: [], primeCount: 0, essentialCount: 0 };
  }
  if (ones.length + dcs.length === total) {
    return { sop: "1", pos: "1", sopTerms: [Array(nVars).fill(-1)], posTerms: [Array(nVars).fill(-1)], groups: [{ literals: Array(nVars).fill(-1), minterms: ones, color: GROUP_COLORS[0], label: "1" }], primeCount: 1, essentialCount: 1 };
  }

  // --- Paso 1: generar implicants primos
  let current: Implicant[] = [
    ...ones.map((m) => ({ mask: fullMask, value: m, covered: [m], hasDC: false })),
    ...dcs.map((m) => ({ mask: fullMask, value: m, covered: [m], hasDC: true })),
  ];
  const primes: Implicant[] = [];
  while (current.length > 0) {
    const combined = new Set<number>();
    const next: Implicant[] = [];
    for (let i = 0; i < current.length; i++) {
      let merged = false;
      for (let j = i + 1; j < current.length; j++) {
        const c = combine(current[i], current[j]);
        if (c) {
          merged = true;
          combined.add(i);
          combined.add(j);
          if (!next.some((x) => x.mask === c.mask && x.value === c.value)) next.push(c);
        }
      }
      if (!merged) primes.push(current[i]);
    }
    current = next;
  }

  // --- Paso 2: seleccionar cobertura (implicants esenciales primero)
  const usablePrimes = primes.filter((p) => p.covered.some((m) => ones.includes(m)));
  const coverage = new Map<number, Implicant[]>();
  for (const m of ones) {
    coverage.set(m, usablePrimes.filter((p) => p.covered.includes(m)));
  }
  const selected: Implicant[] = [];
  const remaining = new Set(ones);
  // esenciales
  for (const [m, ps] of coverage) {
    if (ps.length === 1 && remaining.has(m)) {
      if (!selected.includes(ps[0])) selected.push(ps[0]);
      ps[0].covered.forEach((x) => remaining.delete(x));
    }
  }
  // cobertura greedy por mayor cobertura
  while (remaining.size > 0) {
    let best: Implicant | null = null;
    let bestCount = -1;
    for (const p of usablePrimes) {
      if (selected.includes(p)) continue;
      const cnt = p.covered.filter((m) => remaining.has(m)).length;
      if (cnt > bestCount) { bestCount = cnt; best = p; }
    }
    if (!best || bestCount <= 0) break;
    selected.push(best);
    best.covered.forEach((m) => remaining.delete(m));
  }

  // --- Construir grupos SOP
  const groups: KGroup[] = selected.map((p, gi) => {
    const literals = Array.from({ length: nVars }, (_, i) => {
      const bit = 1 << (nVars - 1 - i);
      if (!(p.mask & bit)) return -1;
      return (p.value & bit) ? 1 : 0;
    });
    return {
      literals,
      minterms: p.covered.filter((m) => ones.includes(m)),
      color: GROUP_COLORS[gi % GROUP_COLORS.length],
      label: termLabel(literals, varNames, "sop"),
    };
  });

  const sopTerms = groups.map((g) => g.literals);
  const sop = groups.map((g) => g.label).join(" + ") || "0";

  // --- POS: minimizar maxtérminos (complemento)
  const zeros: number[] = [];
  for (let m = 0; m < total; m++) if (!ones.includes(m) && !dcs.includes(m)) zeros.push(m);
  let pos = "1";
  let posTerms: number[][] = [];
  if (zeros.length > 0) {
    // F' en SOP, luego aplicar De Morgan para POS
    const fprime = minimizeInternalOnly(zeros, dcs, nVars);
    posTerms = fprime.selected.map((p) =>
      Array.from({ length: nVars }, (_, i) => {
        const bit = 1 << (nVars - 1 - i);
        if (!(p.mask & bit)) return -1;
        return (p.value & bit) ? 0 : 1; // invertido para POS (maxtérminos)
      }),
    );
    pos = fprime.selected
      .map((p) => {
        const literals = Array.from({ length: nVars }, (_, i) => {
          const bit = 1 << (nVars - 1 - i);
          if (!(p.mask & bit)) return -1;
          return (p.value & bit) ? 0 : 1;
        });
        return wrapPos(termLabel(literals, varNames, "pos"));
      })
      .join(" · ") || "1";
  }

  return { sop, pos, sopTerms, posTerms, groups, primeCount: primes.length, essentialCount: selected.length };
}

/** QM interno (devuelve implicants seleccionados sin formatear) */
function minimizeInternalOnly(ones: number[], dontcares: number[], nVars: number): { selected: Implicant[] } {
  const total = 1 << nVars;
  const fullMask = total - 1;
  if (ones.length === 0) return { selected: [] };
  if (ones.length + dontcares.length === total) {
    return { selected: [{ mask: 0, value: 0, covered: [...ones], hasDC: dontcares.length > 0 }] };
  }
  let current: Implicant[] = [
    ...ones.map((m) => ({ mask: fullMask, value: m, covered: [m], hasDC: false })),
    ...dontcares.map((m) => ({ mask: fullMask, value: m, covered: [m], hasDC: true })),
  ];
  const primes: Implicant[] = [];
  while (current.length > 0) {
    const next: Implicant[] = [];
    const mergedFlag = new Set<number>();
    for (let i = 0; i < current.length; i++) {
      let merged = false;
      for (let j = i + 1; j < current.length; j++) {
        const c = combine(current[i], current[j]);
        if (c) {
          merged = true;
          mergedFlag.add(i); mergedFlag.add(j);
          if (!next.some((x) => x.mask === c.mask && x.value === c.value)) next.push(c);
        }
      }
      if (!merged) primes.push(current[i]);
    }
    current = next;
  }
  const usable = primes.filter((p) => p.covered.some((m) => ones.includes(m)));
  const selected: Implicant[] = [];
  const remaining = new Set(ones);
  for (const m of ones) {
    const ps = usable.filter((p) => p.covered.includes(m));
    if (ps.length === 1 && remaining.has(m)) {
      if (!selected.includes(ps[0])) selected.push(ps[0]);
      ps[0].covered.forEach((x) => remaining.delete(x));
    }
  }
  while (remaining.size > 0) {
    let best: Implicant | null = null;
    let bestCount = -1;
    for (const p of usable) {
      if (selected.includes(p)) continue;
      const cnt = p.covered.filter((m) => remaining.has(m)).length;
      if (cnt > bestCount) { bestCount = cnt; best = p; }
    }
    if (!best || bestCount <= 0) break;
    selected.push(best);
    best.covered.forEach((m) => remaining.delete(m));
  }
  return { selected };
}

/**
 * Orden de celdas de un mapa de Karnaugh (Gray code).
 * Para nVars=4: filas AB (00,01,11,10), columnas CD (00,01,11,10).
 */
export function grayOrder(n: number): number[] {
  const total = 1 << n;
  const order: number[] = [];
  for (let i = 0; i < total; i++) order.push(i ^ (i >> 1));
  return order;
}

/** parse de entrada "0,1,2,5" o "F=Σm(0,1,2)" → number[] */
export function parseMintermList(input: string): number[] {
  const inner = input.match(/\(([^)]*)\)/);
  const list = inner ? inner[1] : input;
  return list
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((x) => !isNaN(x));
}
