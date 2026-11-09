// El lienzo: pan y zoom, arrastrar desde el catálogo, conexiones validadas y menú contextual.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
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

const nodeTypes = { circuit: CircuitNode };
const edgeTypes = { wire: WireEdge };

type Menu = { x: number; y: number } & ({ compId: string; wireId?: never } | { wireId: string; compId?: never });

const opcion = "block w-full px-3 py-2 text-left text-[13px] text-tinta hover:bg-hoja-2 focus-visible:bg-hoja-2";

function CanvasInner() {
  const store = useCircuit();
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cableElegido, setCableElegido] = useState<string | null>(null);
  const tactil = useSyncExternalStore(
    () => () => {},
    () => matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  const { components, wires, selection, mode, running, pinValues, drivenMap, compStates, oscillating, clockHz } = store;
  const animar = mode === "sim" && (!running || clockHz <= 6);
  const cableVigente = mode === "edit" && wires.some((w) => w.id === cableElegido) ? cableElegido : null;

  const nodes: CircuitFlowNode[] = useMemo(
    () =>
      components.map((c) => {
        const geo = nodeGeometry(c.type, c.props);
        return {
          id: c.id,
          type: "circuit" as const,
          position: { x: c.x, y: c.y },
          selected: selection.includes(c.id),
          className: getDef(c.type)?.clickable ? "clicable" : undefined,
          width: geo.width,
          height: geo.height,
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
          style: { width: geo.width, height: geo.height },
        };
      }),
    [components, selection, mode, pinValues, drivenMap, compStates, running, oscillating],
  );

  const edges: Edge[] = useMemo(
    () =>
      wires.map((w) => {
        const src = components.find((c) => c.id === w.fromComponent);
        let width = 1;
        if (src) {
          const pin = pinsOf(src.type, src.props).find((p) => p.id === w.fromPin);
          if (pin) width = pin.width;
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
          data: { value, width, animar, simActive: mode === "sim", elegido: w.id === cableVigente },
        };
      }),
    [wires, components, mode, pinValues, animar, cableVigente],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/dislogic") as ComponentType;
      if (!type || !getDef(type)) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      store.addComponent(type, position.x - 46, position.y - 25);
    },
    [screenToFlowPosition, store],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "position" && ch.position) store.moveComponent(ch.id, ch.position.x, ch.position.y);
        else if (ch.type === "remove") store.deleteComponents([ch.id]);
      }
      // La selección con rectángulo y con Shift llega por acá.
      const elegidas = changes.filter((ch) => ch.type === "select");
      if (elegidas.length > 0) {
        const actual = new Set(useCircuit.getState().selection);
        for (const ch of elegidas) {
          if (ch.selected) actual.add(ch.id);
          else actual.delete(ch.id);
        }
        store.setSelection([...actual]);
      }
    },
    [store],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;
      const ok = store.connect(conn.source, conn.sourceHandle, conn.target, conn.targetHandle);
      if (!ok) store.pushLog("warn", "No se conectó: revisá la dirección y el ancho de los pines.");
    },
    [store],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false;
      if (!conn.sourceHandle || !conn.targetHandle) return false;
      const src = components.find((c) => c.id === conn.source);
      const dst = components.find((c) => c.id === conn.target);
      if (!src || !dst) return false;
      const sp = pinsOf(src.type, src.props).find((p) => p.id === conn.sourceHandle);
      const dp = pinsOf(dst.type, dst.props).find((p) => p.id === conn.targetHandle);
      if (!sp || !dp || sp.direction !== "output" || dp.direction !== "input") return false;
      return sp.width === dp.width;
    },
    [components],
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      const comp = components.find((c) => c.id === node.id);
      if (!comp) return;
      setCableElegido(null);
      if (mode === "sim") store.toggleInteractive(comp.id);
      else if (!e.shiftKey) store.setSelection([comp.id]);
    },
    [components, mode, store],
  );

  useEffect(() => {
    const cerrar = () => setMenu(null);
    window.addEventListener("click", cerrar);
    return () => window.removeEventListener("click", cerrar);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "Escape") setMenu(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (cableVigente) {
          e.preventDefault();
          store.disconnectWire(cableVigente);
          setCableElegido(null);
        } else if (selection.length > 0) {
          e.preventDefault();
          store.deleteComponents(selection);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selection.length > 0) {
        e.preventDefault();
        store.duplicateComponent(selection[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, selection, cableVigente]);

  // Órdenes que llegan de las barras y del catálogo.
  useEffect(() => {
    const zIn = () => zoomIn({ duration: 150 });
    const zOut = () => zoomOut({ duration: 150 });
    const fit = () => fitView({ padding: 0.2, duration: 200, maxZoom: 1.3 });
    let tandas = 0;
    const agregar = (e: Event) => {
      const r = wrapperRef.current?.getBoundingClientRect();
      if (!r) return;
      const p = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      const corrimiento = (tandas++ % 6) * 24;
      useCircuit.getState().addComponent((e as CustomEvent<ComponentType>).detail, p.x - 46 + corrimiento, p.y - 25 + corrimiento);
    };
    window.addEventListener("dislogic:zoomin", zIn);
    window.addEventListener("dislogic:zoomout", zOut);
    window.addEventListener("dislogic:fit", fit);
    window.addEventListener("dislogic:agregar", agregar);
    return () => {
      window.removeEventListener("dislogic:zoomin", zIn);
      window.removeEventListener("dislogic:zoomout", zOut);
      window.removeEventListener("dislogic:fit", fit);
      window.removeEventListener("dislogic:agregar", agregar);
    };
  }, [zoomIn, zoomOut, fitView, screenToFlowPosition]);

  const compMenu = components.find((c) => c.id === menu?.compId);
  const cerrarCon = (f: () => void) => () => {
    f();
    setMenu(null);
  };

  return (
    <div ref={wrapperRef} className={`h-full w-full ${mode === "sim" ? "modo-sim" : ""}`} data-testid="circuit-canvas">
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
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, compId: n.id });
        }}
        onEdgeClick={(_, edge) => {
          if (mode !== "edit") return;
          store.setSelection([]);
          setCableElegido(edge.id);
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          if (mode === "edit") setMenu({ x: e.clientX, y: e.clientY, wireId: edge.id });
        }}
        onPaneClick={() => {
          store.setSelection([]);
          setCableElegido(null);
        }}
        nodesDraggable={mode === "edit"}
        nodesConnectable={mode === "edit"}
        elementsSelectable
        deleteKeyCode={null}
        multiSelectionKeyCode={["Shift"]}
        selectionOnDrag={mode === "edit" && !tactil}
        panOnDrag={mode === "sim" || tactil ? true : [1, 2]}
        panOnScroll
        zoomOnScroll={false}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.15}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        defaultEdgeOptions={{ type: "wire" }}
        connectionRadius={24}
      >
        <Background id="fina" variant={BackgroundVariant.Lines} gap={20} lineWidth={1} color="var(--cuadricula)" />
        <Background id="gruesa" variant={BackgroundVariant.Lines} gap={100} lineWidth={1} color="var(--cuadricula-fuerte)" />
        <Controls className="!bottom-3 !left-3" showInteractive={false} />
      </ReactFlow>

      {menu && (compMenu || menu.wireId) && (
        <div
          role="menu"
          className="fixed z-50 w-52 border border-linea-fuerte bg-hoja py-1"
          style={{ left: Math.min(menu.x, innerWidth - 216), top: Math.min(menu.y, innerHeight - 180) }}
          data-testid="ctx-menu"
        >
          {compMenu ? (
            <>
              <p className="border-b border-linea px-3 py-1.5 text-[12px] text-tinta-2">{getDef(compMenu.type)?.label}</p>
              <button role="menuitem" className={opcion} onClick={cerrarCon(() => store.openTruthTable(compMenu.id))}>
                Ver tabla de verdad
              </button>
              <button
                role="menuitem"
                className={opcion}
                onClick={cerrarCon(() => {
                  store.setSelection([compMenu.id]);
                  store.setRightTab("props");
                })}
              >
                Propiedades
              </button>
              <button role="menuitem" className={opcion} onClick={cerrarCon(() => store.duplicateComponent(compMenu.id))}>
                Duplicar
              </button>
              <button role="menuitem" className={`${opcion} !text-fallo`} onClick={cerrarCon(() => store.deleteComponents([compMenu.id]))}>
                Eliminar
              </button>
            </>
          ) : (
            <button role="menuitem" className={`${opcion} !text-fallo`} onClick={cerrarCon(() => store.disconnectWire(menu.wireId!))}>
              Eliminar cable
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Lo que se ve con la hoja vacía: una acción concreta para empezar. */
export function EmptyState() {
  const abrir = useCircuit((s) => s.setExamplesOpen);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-sm border border-linea-fuerte bg-hoja p-5">
        <h2 className="text-[17px] font-bold text-tinta">La hoja está vacía</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-tinta-2">
          Arrastrá una pieza del catálogo o cargá un circuito de ejemplo para simularlo.
        </p>
        <button onClick={() => abrir(true)} className="mt-3 border border-tinta bg-tinta px-3 py-2 text-[13px] font-bold text-papel hover:bg-transparent hover:text-tinta">
          Ver ejemplos
        </button>
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
