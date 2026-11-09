// Un cable. El 1 es grueso y de color, el 0 es fino, sin conducir va punteado; un bus lleva la marca de los esquemáticos.
"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export interface WireEdgeData {
  value: number | undefined;
  width: number;
  animar: boolean;
  simActive: boolean;
  elegido: boolean;
}

const WireEdgeInner = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) => {
  const d = (data ?? {}) as unknown as WireEdgeData;
  const ancho = d.width ?? 1;
  const v = d.value;
  // React Flow da el borde externo del área del pin; el cable tiene que llegar al punto.
  const medio = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? 14 : 8;
  const [camino, lx, ly] = getSmoothStepPath({
    sourceX: sourceX - medio,
    sourceY,
    sourcePosition,
    targetX: targetX + medio,
    targetY,
    targetPosition,
    borderRadius: 0,
    offset: 14,
  });

  const flotante = d.simActive && v === undefined;
  const activo = d.simActive && v !== undefined && v !== 0;
  const color = d.elegido
    ? "var(--sel)"
    : !d.simActive
      ? "var(--tinta)"
      : flotante
        ? "var(--flotante)"
        : activo
          ? "var(--alto)"
          : "var(--bajo)";
  const grosor = (ancho > 1 ? 1.2 : 0) + (activo ? 2.6 : 1.4) + (d.elegido ? 0.8 : 0);

  return (
    <>
      <BaseEdge id={id} path={camino} interactionWidth={16} style={{ stroke: color, strokeWidth: grosor, strokeDasharray: flotante ? "5 4" : undefined }} />
      {d.animar && v !== undefined && (
        <path key={v} className="frente" d={camino} pathLength={1} fill="none" stroke="var(--tinta)" strokeWidth={grosor + 1} pointerEvents="none" />
      )}
      {ancho > 1 && (
        <g pointerEvents="none">
          <line x1={lx - 4} y1={ly + 6} x2={lx + 4} y2={ly - 6} stroke="var(--tinta)" strokeWidth={1.3} />
          <text x={lx + 6} y={ly - 5} fontSize={11} fontFamily="var(--font-mono)" fill="var(--tinta)" style={{ paintOrder: "stroke", stroke: "var(--papel)", strokeWidth: 3 }}>
            {ancho}
          </text>
        </g>
      )}
    </>
  );
};

export const WireEdge = memo(WireEdgeInner);
