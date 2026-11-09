// Símbolos ANSI de las compuertas. Se dibujan igual en el lienzo y en el catálogo.
import type { ComponentType } from "@/lib/circuit/types";

export const COMPUERTAS: ComponentType[] = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "TRI_STATE_BUFFER"];

const X0 = 16; // donde empieza el cuerpo
const LARGO = 56; // largo del cuerpo
const BURBUJA = 3.6;
const CONCAVIDAD = 18; // control de la curva trasera de OR

export function posPin(i: number, total: number, alto: number) {
  return (alto / (total + 1)) * (i + 1);
}

/** Color de una señal. En edición (`sim` falso) todo es tinta. */
export function colorSenal(v: number | undefined, sim: boolean) {
  if (!sim) return "var(--tinta)";
  if (v === undefined) return "var(--flotante)";
  return v !== 0 ? "var(--alto)" : "var(--bajo)";
}
export function grosorSenal(v: number | undefined, sim: boolean) {
  return sim && v !== undefined && v !== 0 ? 2.6 : 1.4;
}

export function SimboloCompuerta({
  tipo,
  nEntradas,
  alto,
  ancho,
  entradas = [],
  salida,
  sim = false,
}: {
  tipo: ComponentType;
  nEntradas: number;
  alto: number;
  ancho: number;
  entradas?: (number | undefined)[];
  salida?: number | undefined;
  sim?: boolean;
}) {
  const h = alto - 8;
  const y0 = 4;
  const cy = alto / 2;
  const fin = X0 + LARGO;
  const curvo = tipo === "OR" || tipo === "NOR" || tipo === "XOR" || tipo === "XNOR";
  const exclusivo = tipo === "XOR" || tipo === "XNOR";
  const triangulo = tipo === "NOT" || tipo === "BUFFER" || tipo === "TRI_STATE_BUFFER";
  const negada = tipo === "NAND" || tipo === "NOR" || tipo === "XNOR" || tipo === "NOT";

  const trazo = { stroke: "var(--tinta)", strokeWidth: 1.6, fill: "var(--hoja)", strokeLinejoin: "round" as const };

  // Hasta dónde llega cada patita de entrada: en OR termina sobre la curva trasera.
  const finPatita = (y: number) => {
    if (!curvo) return X0;
    const t = Math.min(1, Math.max(0, (y - y0) / h));
    return (exclusivo ? X0 - 6 : X0) + 2 * t * (1 - t) * CONCAVIDAD;
  };

  let cuerpo: React.ReactNode = null;
  if (tipo === "AND" || tipo === "NAND") {
    const rx = Math.min(h / 2, 28);
    cuerpo = <path d={`M${X0},${y0} H${fin - rx} A${rx},${h / 2} 0 0 1 ${fin - rx},${y0 + h} H${X0} Z`} {...trazo} />;
  } else if (curvo) {
    cuerpo = (
      <path
        d={`M${X0},${y0} Q${X0 + LARGO * 0.55},${y0} ${fin},${cy} Q${X0 + LARGO * 0.55},${y0 + h} ${X0},${y0 + h} Q${X0 + CONCAVIDAD},${cy} ${X0},${y0} Z`}
        {...trazo}
      />
    );
  } else if (triangulo) {
    cuerpo = <path d={`M${X0},${y0 + 1} L${fin - 6},${cy} L${X0},${y0 + h - 1} Z`} {...trazo} />;
  }

  const xFinal = triangulo ? fin - 6 : fin;
  const inicioSalida = negada ? xFinal + BURBUJA * 2 : xFinal;

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: nEntradas }, (_, i) => {
        const y = posPin(i, nEntradas, alto);
        return (
          <line key={i} x1={0} y1={y} x2={finPatita(y)} y2={y} stroke={colorSenal(entradas[i], sim)} strokeWidth={grosorSenal(entradas[i], sim)} />
        );
      })}
      {exclusivo && <path d={`M${X0 - 6},${y0} Q${X0 - 6 + CONCAVIDAD},${cy} ${X0 - 6},${y0 + h}`} fill="none" stroke="var(--tinta)" strokeWidth={1.6} />}
      {cuerpo}
      {negada && <circle cx={xFinal + BURBUJA} cy={cy} r={BURBUJA} {...trazo} strokeWidth={1.4} />}
      <line x1={inicioSalida} y1={cy} x2={ancho} y2={cy} stroke={colorSenal(salida, sim)} strokeWidth={grosorSenal(salida, sim)} />
    </svg>
  );
}

/** Multiplexor y demultiplexor: el trapecio de los libros. */
export function SimboloPlexor({ tipo, ancho, alto }: { tipo: "MUX" | "DMUX"; ancho: number; alto: number }) {
  const m = 14;
  const inclinacion = Math.min(14, alto / 5);
  const puntos =
    tipo === "MUX"
      ? `${m},2 ${ancho - m},${2 + inclinacion} ${ancho - m},${alto - 2 - inclinacion} ${m},${alto - 2}`
      : `${m},${2 + inclinacion} ${ancho - m},2 ${ancho - m},${alto - 2} ${m},${alto - 2 - inclinacion}`;
  return (
    <svg width={ancho} height={alto} className="pointer-events-none absolute inset-0" aria-hidden>
      <polygon points={puntos} fill="var(--hoja)" stroke="var(--tinta)" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
