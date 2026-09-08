// ============================================================
// DisLogic — Cable (custom edge) con color según valor de señal
// y animación de flujo eléctrico cuando la señal está activa
// ============================================================
"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from "@xyflow/react";

export interface WireEdgeData {
  value: number | undefined;
  width: number;
  running: boolean;
  unstable?: boolean;
  simActive?: boolean;
}

function fmtBusLabel(width: number): string {
  return `/${width}`;
}

const WireEdgeInner = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps) => {
  const { edge } = data as unknown as { edge?: { id: string } };
  void edge;
  const d = (data ?? {}) as WireEdgeData;
  const width = d.width ?? 1;
  const value = d.value;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    borderRadius: 8,
    offset: 0,
  });

  const floating = value === undefined;
  const active = value === 1 || (width > 1 && value !== undefined && value !== 0);
  const color = floating
    ? d.simActive
      ? "#55637A" // flotante en simulación
      : "#3D4C63" // estructura en modo edición
    : active
      ? "#00FF88"
      : "#FF4444";
  const strokeWidth = width > 1 ? 3.2 : 1.8;

  return (
    <>
      {/* zona de clic más amplia */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="react-flow__edge-interaction"
      />
      {floating && (
        <BaseEdge
          id={id}
          path={path}
          style={{
            stroke: color,
            strokeWidth,
            strokeDasharray: d.simActive ? "5 4" : undefined,
            opacity: d.simActive ? 0.75 : 0.9,
          }}
        />
      )}
      {!floating && (
        <BaseEdge
          id={id}
          path={path}
          style={{
            stroke: color,
            strokeWidth,
            filter: selected
              ? `drop-shadow(0 0 4px ${color})`
              : active && d.running
                ? `drop-shadow(0 0 3px ${color}88)`
                : undefined,
          }}
        />
      )}
      {/* pulso eléctrico viajando por el cable */}
      {active && d.running && (
        <>
          <circle r={width > 1 ? 3.4 : 2.6} fill="#B8FFE0">
            <animateMotion dur="0.9s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r={width > 1 ? 2.2 : 1.6} fill="#FFFFFF" opacity={0.9}>
            <animateMotion dur="0.9s" begin="0.45s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
      {d.unstable && (
        <circle r={4} fill="#FF4444">
          <animate attributeName="opacity" values="1;0.2;1" dur="0.4s" repeatCount="indefinite" />
          <animateMotion dur="0.4s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {width > 1 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="rounded bg-[#0D1420] px-1 font-mono text-[9px] text-slate-300 ring-1 ring-slate-700"
          >
            {fmtBusLabel(width)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const WireEdge = memo(WireEdgeInner);

/** componente auxiliar para borrar usando el teclado dentro del edge */
export function useEdgeDeleteGuard() {
  const { deleteElements } = useReactFlow();
  return deleteElements;
}
