// ============================================================
// DisLogic — Canvas infinito (pan/zoom) con React Flow
// Drag & drop desde la paleta, conexiones validadas,
// menú contextual, mini-mapa y controles de zoom
// ============================================================
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type IsValidConnection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCircuit } from "@/lib/circuit/store";
import { getDef } from "@/lib/circuit/catalog";
import type { ComponentType } from "@/lib/circuit/types";
import { CircuitNode, nodeGeometry, pinsOf, type CircuitFlowNode } from "./circuit-node";
import { WireEdge } from "./wire-edge";
import { useToast } from "@/hooks/use-toast";

const nodeTypes = { circuit: CircuitNode };
const edgeTypes = { wire: WireEdge };

interface ContextMenuState {
  x: number;
  y: number;
  compId: string;
}

function CanvasInner() {
  const store = useCircuit();
  const { toast } = useToast();
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const {
    components,
    wires,
    selection,
    mode,
    running,
    pinValues,
    drivenMap,
    compStates,
    oscillating,
    simVersion,
  } = store;
  void simVersion;

  // ---------- nodos derivados ----------
  const nodes: CircuitFlowNode[] = useMemo(
    () =>
      components.map((c) => {
        const geo = nodeGeometry(c.type, c.props);
        return {
          id: c.id,
          type: "circuit" as const,
          position: { x: c.x, y: c.y },
          selected: selection.includes(c.id),
          data: {
            compType: c.type,
            label: c.label ?? getDef(c.type)?.label ?? c.type,
            props: c.props,
            selected: selection.includes(c.id),
            mode,
            values: mode === "sim" ? pinValues : {},
            driven: drivenMap,
            running: mode === "sim" && running,
            unstable: oscillating,
            states: mode === "sim" ? (compStates[c.id] ?? {}) : {},
          },
          style: { width: geo.width },
        };
      }),
    [components, selection, mode, pinValues, drivenMap, compStates, running, oscillating],
  );

  // ---------- cables derivados ----------
  const edges: Edge[] = useMemo(
    () =>
      wires.map((w) => {
        const src = components.find((c) => c.id === w.fromComponent);
        const dst = components.find((c) => c.id === w.toComponent);
        let width = 1;
        if (src && dst) {
          const srcPins = pinsOf(src.type, src.props);
          const pin = srcPins.find((p) => p.id === w.fromPin);
          if (pin) width = typeof pin.width === "function" ? pin.width(src.props) : pin.width;
        }
        const value = mode === "sim" ? pinValues[`${w.fromComponent}:${w.fromPin}`] : undefined;
        return {
          id: w.id,
          source: w.fromComponent,
          target: w.toComponent,
          sourceHandle: w.fromPin,
          targetHandle: w.toPin,
          type: "wire" as const,
          selected: false,
          data: { value, width, running: mode === "sim" && running, unstable: oscillating, simActive: mode === "sim" },
        };
      }),
    [wires, components, mode, pinValues, running, oscillating],
  );

  // ---------- drag & drop desde paleta ----------
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/dislogic") as ComponentType;
      if (!type || !getDef(type)) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      store.addComponent(type, position.x - 60, position.y - 30);
    },
    [screenToFlowPosition, store],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // ---------- cambios de posición ----------
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "position" && ch.position) {
          store.moveComponent(ch.id, ch.position.x, ch.position.y);
        } else if (ch.type === "remove") {
          store.deleteComponents([ch.id]);
        }
      }
    },
    [store],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;
      const ok = store.connect(conn.source, conn.sourceHandle, conn.target, conn.targetHandle);
      if (!ok) toast({ title: "Conexión inválida", description: "Verificá dirección y ancho de los pines.", variant: "destructive" });
    },
    [store, toast],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false;
      if (!conn.sourceHandle || !conn.targetHandle) return false;
      const src = components.find((c) => c.id === conn.source);
      const dst = components.find((c) => c.id === conn.target);
      if (!src || !dst) return false;
      const srcPins = pinsOf(src.type, src.props);
      const dstPins = pinsOf(dst.type, dst.props);
      const sp = srcPins.find((p) => p.id === conn.sourceHandle);
      const dp = dstPins.find((p) => p.id === conn.targetHandle);
      if (!sp || !dp) return false;
      if (sp.direction !== "output" || dp.direction !== "input") return false;
      const sw = typeof sp.width === "function" ? sp.width(src.props) : sp.width;
      const dw = typeof dp.width === "function" ? dp.width(dst.props) : dp.width;
      return sw === dw;
    },
    [components],
  );

  // ---------- clic y menú contextual ----------
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const comp = components.find((c) => c.id === node.id);
      if (!comp) return;
      if (mode === "sim") {
        store.toggleInteractive(comp.id);
      } else {
        store.setSelection([comp.id]);
      }
    },
    [components, mode, store],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setCtxMenu({ x: event.clientX, y: event.clientY, compId: node.id });
    },
    [],
  );

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ---------- atajos ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length > 0) {
        e.preventDefault();
        store.deleteComponents(selection);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selection.length > 0) {
        e.preventDefault();
        store.duplicateComponent(selection[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, selection]);

  // ---------- zoom desde la barra superior ----------
  useEffect(() => {
    const zIn = () => zoomIn({ duration: 200 });
    const zOut = () => zoomOut({ duration: 200 });
    const fit = () => fitView({ padding: 0.2, duration: 300 });
    window.addEventListener("dislogic:zoomin", zIn);
    window.addEventListener("dislogic:zoomout", zOut);
    window.addEventListener("dislogic:fit", fit);
    return () => {
      window.removeEventListener("dislogic:zoomin", zIn);
      window.removeEventListener("dislogic:zoomout", zOut);
      window.removeEventListener("dislogic:fit", fit);
    };
  }, [zoomIn, zoomOut, fitView]);

  const ctxComp = components.find((c) => c.id === ctxMenu?.compId);

  return (
    <div ref={wrapperRef} className="h-full w-full" data-testid="circuit-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => store.setSelection([])}
        nodesDraggable={mode === "edit"}
        nodesConnectable={mode === "edit"}
        elementsSelectable
        deleteKeyCode={null}
        multiSelectionKeyCode={["Shift"]}
        selectionOnDrag={mode === "edit"}
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.15}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        defaultEdgeOptions={{ type: "wire" }}
        connectionRadius={24}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#1E2A3C" />
        <Controls
          className="!bottom-3 !left-3 !shadow-lg [&>button]:!bg-[#131A26] [&>button]:!border-slate-700 [&>button]:!fill-slate-300 [&>button:hover]:!bg-[#1B2536]"
          showInteractive={false}
        />
        <MiniMap
          className="!bottom-3 !right-3 !hidden md:!block"
          pannable
          zoomable
          bgColor="#0B111C"
          maskColor="#0B111CBB"
          nodeColor="#26364F"
          nodeStrokeColor="#00AAFF66"
          nodeBorderRadius={4}
        />
      </ReactFlow>

      {/* menú contextual */}
      {ctxMenu && ctxComp && (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-slate-700 bg-[#131A26] py-1 shadow-2xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          data-testid="ctx-menu"
        >
          <div className="border-b border-slate-700/60 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            {getDef(ctxComp.type)?.label}
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-[#1B2536]"
            onClick={() => {
              store.openTruthTable(ctxComp.id);
              setCtxMenu(null);
            }}
          >
            📋 Ver tabla de verdad
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-[#1B2536]"
            onClick={() => {
              store.setSelection([ctxComp.id]);
              store.setRightTab("props");
              setCtxMenu(null);
            }}
          >
            ⚙️ Propiedades
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-[#1B2536]"
            onClick={() => {
              store.duplicateComponent(ctxComp.id);
              setCtxMenu(null);
            }}
          >
            ⧉ Duplicar
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/40"
            onClick={() => {
              store.deleteComponents([ctxComp.id]);
              setCtxMenu(null);
            }}
          >
            🗑 Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

/** pista visual para canvas vacío */
export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl border border-dashed border-slate-700 bg-[#0F1521]/80 px-8 py-6 text-center">
        <p className="text-sm font-medium text-slate-300">Arrastrá componentes desde la paleta</p>
        <p className="mt-1 text-xs text-slate-500">o abrí la galería de ejemplos para cargar un circuito</p>
      </div>
    </div>
  );
}

export function CircuitCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
