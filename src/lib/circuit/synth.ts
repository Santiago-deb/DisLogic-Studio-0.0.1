// ============================================================
// DisLogic — Síntesis automática: mintérminos → circuito AND-OR
// Genera el circuito en el canvas a partir de la expresión mínima
// ============================================================
import { minimize } from "./karnaugh";
import type { ComponentInstance, ComponentType, Wire } from "./types";
import { CATALOG } from "./catalog";

interface Built {
  components: ComponentInstance[];
  wires: Wire[];
}

let synthCounter = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}${(synthCounter++).toString(36)}`;

function mk(type: ComponentType, x: number, y: number, props: Record<string, unknown> = {}, label?: string): ComponentInstance {
  const def = CATALOG[type];
  return { id: nid("c"), type, x, y, props: { ...JSON.parse(JSON.stringify(def.defaults)), ...props }, label: label ?? def.label };
}

function conn(components: ComponentInstance[], wires: Wire[], from: ComponentInstance, fromPin: string, to: ComponentInstance, toPin: string) {
  wires.push({ id: nid("w"), fromComponent: from.id, fromPin, toComponent: to.id, toPin });
}

/**
 * Construye el circuito SOP (AND-OR-Invert) para F = Σm(minterms) + d(dontcares)
 * Devuelve componentes y cables listos para insertar en el canvas.
 */
export function buildSopCircuit(
  minterms: number[],
  dontcares: number[],
  nVars: number,
  originX = 120,
  originY = 120,
): Built & { expression: string } {
  const res = minimize(minterms, dontcares, nVars);
  const components: ComponentInstance[] = [];
  const wires: Wire[] = [];

  // 1) pines de entrada (una por variable)
  const vars: ComponentInstance[] = [];
  for (let i = 0; i < nVars; i++) {
    const input = mk("INPUT_PIN", originX, originY + i * 90);
    (input.props as Record<string, unknown>).value = 0;
    components.push(input);
    vars.push(input);
  }

  // 2) inversores (los que hagan falta)
  const nots: Record<number, ComponentInstance> = {};
  let notCount = 0;
  for (const term of res.sopTerms) {
    for (let i = 0; i < term.length; i++) {
      if (term[i] === 0 && !nots[i]) {
        const inv = mk("NOT", originX + 130, originY + i * 90 + 28);
        components.push(inv);
        conn(components, wires, vars[i], "out", inv, "in0");
        nots[i] = inv;
        notCount++;
      }
    }
  }

  // 3) compuertas AND por término de producto
  const andGates: ComponentInstance[] = [];
  const andY0 = originY + nVars * 90 + 40;
  res.sopTerms.forEach((term, ti) => {
    const literals = term.filter((l) => l !== -1).length;
    let and: ComponentInstance;
    if (literals === 0) {
      // término constante "1"
      and = mk("POWER", originX + 260, andY0 + ti * 80);
    } else if (literals === 1) {
      and = mk("BUFFER", originX + 260, andY0 + ti * 80);
    } else {
      and = mk("AND", originX + 260, andY0 + ti * 80, { nIn: literals });
    }
    components.push(and);
    andGates.push(and);
    // conectar literales
    let pin = 0;
    for (let i = 0; i < term.length; i++) {
      const lit = term[i];
      if (lit === -1) continue;
      const src = lit === 1 ? vars[i] : nots[i];
      const pinId = and.type === "AND" ? `in${pin}` : "in0";
      conn(components, wires, src, "out", and, pinId);
      pin++;
    }
  });

  // 4) compuerta OR final (o buffer si hay un solo término)
  const output = mk("OUTPUT_PIN", originX + 430, andY0 + ((res.sopTerms.length - 1) * 80) / 2);
  components.push(output);

  if (andGates.length === 1) {
    conn(components, wires, andGates[0], "out", output, "in0");
  } else if (andGates.length > 1) {
    const or = mk("OR", originX + 430, andY0, { nIn: Math.min(andGates.length, 8) });
    components.push(or);
    andGates.forEach((g, gi) => {
      if (gi < 8) conn(components, wires, g, "out", or, `in${gi}`);
    });
    conn(components, wires, or, "out", output, "in0");
  }

  return { components, wires, expression: res.sop };
}
