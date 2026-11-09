// ============================================================
// DisLogic — Store central (Zustand)
// Documento de circuito + simulación + UI + undo/redo
// ============================================================
"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import { CATALOG, getDef } from "./catalog";
import { Simulator } from "./simulator";
import { buildSopCircuit } from "./synth";
import type {
  CircuitData,
  ComponentInstance,
  ComponentType,
  LogMessage,
  SignalValue,
  WaveSample,
  Wire,
} from "./types";

interface Snapshot {
  components: ComponentInstance[];
  wires: Wire[];
}

export type AppMode = "edit" | "sim";
export type RightTab = "props" | "kmap" | "wave" | "info";

interface CircuitStore {
  // ---------- documento ----------
  projectName: string;
  components: ComponentInstance[];
  wires: Wire[];
  selection: string[];

  // ---------- simulación ----------
  mode: AppMode;
  running: boolean;
  temporal: boolean;
  clockHz: number;
  simVersion: number;
  pinValues: Record<string, SignalValue>;
  compStates: Record<string, Record<string, unknown>>;
  drivenMap: Record<string, boolean>;
  oscillating: boolean;

  // ---------- waveform ----------
  probes: string[];
  waveHistory: WaveSample[];

  // ---------- UI ----------
  rightTab: RightTab;
  log: LogMessage[];
  truthTableFor: string | null; // compId
  examplesOpen: boolean;
  processorOpen: boolean;
  helpOpen: boolean;
  fpgaOpen: boolean;
  shareDialog: boolean;
  shareUrl: string | null;

  // ---------- internos ----------
  private_undo: Snapshot[];
  private_redo: Snapshot[];

  // ---------- acciones ----------
  addComponent: (type: ComponentType, x: number, y: number) => string | undefined;
  updateComponentProps: (id: string, props: Record<string, unknown>) => void;
  renameComponent: (id: string, label: string) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  deleteComponents: (ids: string[]) => void;
  duplicateComponent: (id: string) => void;
  connect: (fromComponent: string, fromPin: string, toComponent: string, toPin: string) => boolean;
  disconnectWire: (wireId: string) => void;
  setSelection: (ids: string[]) => void;

  toggleInteractive: (compId: string) => void;

  setMode: (m: AppMode) => void;
  setRunning: (r: boolean) => void;
  stepSim: () => void;
  resetSim: () => void;
  setTemporal: (t: boolean) => void;
  setClockHz: (hz: number) => void;

  setProbes: (keys: string[]) => void;
  clearWaveHistory: () => void;

  setRightTab: (t: RightTab) => void;
  pushLog: (level: LogMessage["level"], text: string) => void;
  clearLog: () => void;
  openTruthTable: (compId: string | null) => void;
  setExamplesOpen: (v: boolean) => void;
  setProcessorOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setFpgaOpen: (v: boolean) => void;
  setShareDialog: (v: boolean, url?: string | null) => void;

  undo: () => void;
  redo: () => void;

  loadCircuit: (data: CircuitData) => void;
  newProject: () => void;
  getCircuit: () => CircuitData;

  synthesizeFromMinterms: (minterms: number[], dontcares: number[], nVars: number) => void;

  // simulation tick plumbing (llamado desde el componente principal)
  afterSimRun: () => void;
}

let logIdCounter = 0;
let simTimer: ReturnType<typeof setInterval> | null = null;

export const useCircuit = create<CircuitStore>((set, get) => {
  const simulator = new Simulator();

  const snapshot = (): Snapshot => ({
    components: JSON.parse(JSON.stringify(get().components)),
    wires: JSON.parse(JSON.stringify(get().wires)),
  });

  const pushUndo = () => {
    const s = snapshot();
    const u = get().private_undo;
    set({ private_undo: [...u.slice(-99), s], private_redo: [] });
  };

  /** reconstruye el motor y estabiliza (si estamos en sim) */
  const refreshSim = (resetStates = false) => {
    const st = get();
    simulator.autoClock = false;
    simulator.setProbes(st.probes);
    simulator.rebuild({ name: st.projectName, components: st.components, wires: st.wires as never });
    if (resetStates) simulator.reset();
    if (st.mode === "sim") {
      const ok = simulator.run();
      set({ oscillating: !ok });
      if (!ok) simulator.run(); // limpiar la cola pendiente
      get().afterSimRun();
    } else {
      get().afterSimRun();
    }
  };

  const stopTimer = () => {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
  };

  return {
    projectName: "Mi Circuitos",
    components: [],
    wires: [],
    selection: [],

    mode: "edit",
    running: false,
    temporal: false,
    clockHz: 2,
    simVersion: 0,
    pinValues: {},
    compStates: {},
    drivenMap: {},
    oscillating: false,

    probes: [],
    waveHistory: [],

    rightTab: "props",
    log: [],
    truthTableFor: null,
    examplesOpen: false,
    processorOpen: false,
    helpOpen: false,
    fpgaOpen: false,
    shareDialog: false,
    shareUrl: null,

    private_undo: [],
    private_redo: [],

    // ------------------------------------------------ acciones documento
    addComponent: (type, x, y) => {
      const def = getDef(type);
      if (!def) return undefined;
      pushUndo();
      const id = `c_${nanoid(8)}`;
      const props = JSON.parse(JSON.stringify(def.defaults));
      const comp: ComponentInstance = { id, type, x: Math.round(x), y: Math.round(y), props, label: def.label };
      set({ components: [...get().components, comp] });
      refreshSim();
      get().pushLog("info", `+ ${def.label} agregado`);
      return id;
    },

    updateComponentProps: (id, props) => {
      pushUndo();
      set({
        components: get().components.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...props } } : c)),
      });
      simulator.setComponentProps(id, get().components.find((c) => c.id === id)!.props);
      refreshSim();
    },

    renameComponent: (id, label) => {
      set({ components: get().components.map((c) => (c.id === id ? { ...c, label } : c)) });
    },

    moveComponent: (id, x, y) => {
      set({
        components: get().components.map((c) => (c.id === id ? { ...c, x: Math.round(x), y: Math.round(y) } : c)),
      });
    },

    deleteComponents: (ids) => {
      if (ids.length === 0) return;
      pushUndo();
      const idSet = new Set(ids);
      set({
        components: get().components.filter((c) => !idSet.has(c.id)),
        wires: get().wires.filter((w) => !idSet.has(w.fromComponent) && !idSet.has(w.toComponent)),
        selection: [],
      });
      refreshSim();
      get().pushLog("info", `${ids.length} componente(s) eliminado(s)`);
    },

    duplicateComponent: (id) => {
      const src = get().components.find((c) => c.id === id);
      if (!src) return;
      pushUndo();
      const newId = `c_${nanoid(8)}`;
      const copy: ComponentInstance = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        x: src.x + 40,
        y: src.y + 40,
      };
      set({ components: [...get().components, copy], selection: [newId] });
      refreshSim();
    },

    connect: (fromComponent, fromPin, toComponent, toPin) => {
      if (fromComponent === toComponent) return false;
      const src = get().components.find((c) => c.id === fromComponent);
      const dst = get().components.find((c) => c.id === toComponent);
      if (!src || !dst) return false;
      const srcDef = CATALOG[src.type];
      const dstDef = CATALOG[dst.type];
      if (!srcDef || !dstDef) return false;
      const srcPins = typeof srcDef.pins === "function" ? srcDef.pins(src.props) : srcDef.pins;
      const dstPins = typeof dstDef.pins === "function" ? dstDef.pins(dst.props) : dstDef.pins;
      const sp = srcPins.find((p) => p.id === fromPin);
      const dp = dstPins.find((p) => p.id === toPin);
      if (!sp || !dp || sp.direction !== "output" || dp.direction !== "input") return false;
      const sw = typeof sp.width === "function" ? sp.width(src.props) : sp.width;
      const dw = typeof dp.width === "function" ? dp.width(dst.props) : dp.width;
      if (sw !== dw) {
        get().pushLog("error", `Ancho incompatible: ${sw} bits → ${dw} bits (${srcDef.short} → ${dstDef.short})`);
        return false;
      }
      // reemplazar cable existente en el pin de destino (un driver por entrada)
      const cleaned = get().wires.filter((w) => !(w.toComponent === toComponent && w.toPin === toPin));
      pushUndo();
      set({ wires: [...cleaned, { id: `w_${nanoid(8)}`, fromComponent, fromPin, toComponent, toPin }] });
      refreshSim();
      return true;
    },

    disconnectWire: (wireId) => {
      pushUndo();
      set({ wires: get().wires.filter((w) => w.id !== wireId) });
      refreshSim();
    },

    setSelection: (ids) => set({ selection: ids }),

    // ------------------------------------------------ interacción sim
    toggleInteractive: (compId) => {
      const st = get();
      if (st.mode !== "sim") return;
      const comp = st.components.find((c) => c.id === compId);
      if (!comp) return;
      const def = CATALOG[comp.type];
      if (!def?.clickable) return;
      if (comp.type === "CLOCK") simulator.toggleClock(compId);
      else simulator.toggleInputPin(compId);
      const ok = simulator.run();
      set({ oscillating: !ok });
      get().afterSimRun();
    },

    // ------------------------------------------------ control de simulación
    setMode: (m) => {
      stopTimer();
      set({ mode: m, running: false, oscillating: false });
      if (m === "sim") {
        get().pushLog("success", "Modo simulación: hacé clic en los pines de entrada y en el reloj.");
        refreshSim();
      } else {
        get().pushLog("info", "Modo edición: arrastrá componentes desde la paleta y conectá los pines.");
        get().afterSimRun();
      }
    },

    setRunning: (r) => {
      const st = get();
      stopTimer();
      set({ running: r });
      if (r && st.mode === "sim") {
        const hasClock = st.components.some((c) => c.type === "CLOCK");
        if (!hasClock) {
          get().pushLog("warn", "No hay ningún reloj en el circuito: el autoproceso no tiene efecto (usá Step o pines manuales).");
        }
        if (st.temporal) {
          // modo temporal: avanzar tiempo ns continuamente
          const stepNs = 5;
          let horizon = simulator.time;
          simTimer = setInterval(() => {
            horizon += stepNs;
            const ok = simulator.run(horizon);
            if (!ok) {
              set({ oscillating: true, running: false });
              stopTimer();
            }
            get().afterSimRun();
          }, 33);
          simulator.autoClock = true;
          // arrancar relojes
          get().components.filter((c) => c.type === "CLOCK").forEach((c) => simulator.scheduleClockToggle(c.id, 1));
          const ok0 = simulator.run(horizon);
          if (!ok0) { set({ oscillating: true, running: false }); stopTimer(); }
          get().afterSimRun();
        } else {
          const hz = get().clockHz;
          simTimer = setInterval(() => {
            get().components.filter((c) => c.type === "CLOCK").forEach((c) => simulator.toggleClock(c.id));
            const ok = simulator.run();
            if (!ok) {
              set({ oscillating: true, running: false });
              stopTimer();
              get().pushLog("error", "Oscilación detectada: la simulación se pausó. Revisá lazos sin retardo (ej: NOT realimentado o Latch T con clock en 1).");
            }
            get().afterSimRun();
          }, Math.max(16, 1000 / hz));
        }
      }
    },

    stepSim: () => {
      const st = get();
      if (st.mode !== "sim") return;
      set({ running: false });
      stopTimer();
      if (st.temporal) {
        // avanzar al próximo instante de evento (propagación visible paso a paso)
        const next = simulator.peekNextTime();
        if (next !== null) simulator.run(next);
      } else {
        // medio ciclo: alternar clocks y estabilizar
        get().components.filter((c) => c.type === "CLOCK").forEach((c) => simulator.toggleClock(c.id));
        const ok = simulator.run();
        if (!ok) get().pushLog("error", "Oscilación detectada durante el paso.");
      }
      get().afterSimRun();
    },

    resetSim: () => {
      stopTimer();
      set({ running: false, oscillating: false });
      simulator.reset();
      simulator.rebuild({ name: get().projectName, components: get().components, wires: get().wires as never });
      simulator.run();
      get().afterSimRun();
      get().pushLog("info", "Simulación reiniciada (estados secuenciales a 0).");
    },

    setTemporal: (t) => {
      set({ temporal: t, running: false });
      stopTimer();
      simulator.reset();
      simulator.rebuild({ name: get().projectName, components: get().components, wires: get().wires as never });
      simulator.run();
      get().afterSimRun();
      get().pushLog("info", t
        ? "Modo temporal ON: los retardos de cada compuerta (ns) se aplican de verdad."
        : "Modo ideal: propagación instantánea (sin retardos).");
    },

    setClockHz: (hz) => {
      set({ clockHz: hz });
      const s = get();
      if (s.running && !s.temporal) s.setRunning(true); // el temporizador toma el período nuevo
    },

    // ------------------------------------------------ waveform
    setProbes: (keys) => {
      set({ probes: keys });
      simulator.setProbes(keys);
    },

    clearWaveHistory: () => {
      simulator.clearHistory();
      set({ waveHistory: [] });
    },

    // ------------------------------------------------ UI
    setRightTab: (t) => set({ rightTab: t }),

    pushLog: (level, text) => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const msg: LogMessage = { id: ++logIdCounter, time, level, text };
      set({ log: [...get().log.slice(-199), msg] });
    },

    clearLog: () => set({ log: [] }),

    openTruthTable: (compId) => set({ truthTableFor: compId }),

    setExamplesOpen: (v) => set({ examplesOpen: v }),
    setProcessorOpen: (v) => set({ processorOpen: v }),
    setHelpOpen: (v) => set({ helpOpen: v }),
    setFpgaOpen: (v) => set({ fpgaOpen: v }),
    setShareDialog: (v, url = null) => set({ shareDialog: v, shareUrl: url }),

    // ------------------------------------------------ undo/redo
    undo: () => {
      const u = get().private_undo;
      if (u.length === 0) return;
      const snap = u[u.length - 1];
      const redoSnap = snapshot();
      set({
        private_undo: u.slice(0, -1),
        private_redo: [...get().private_redo.slice(-99), redoSnap],
        components: snap.components,
        wires: snap.wires,
        selection: [],
      });
      refreshSim();
    },

    redo: () => {
      const r = get().private_redo;
      if (r.length === 0) return;
      const snap = r[r.length - 1];
      const undoSnap = snapshot();
      set({
        private_redo: r.slice(0, -1),
        private_undo: [...get().private_undo.slice(-99), undoSnap],
        components: snap.components,
        wires: snap.wires,
        selection: [],
      });
      refreshSim();
    },

    // ------------------------------------------------ documento
    loadCircuit: (data) => {
      pushUndo();
      set({
        projectName: data.name || "Sin título",
        components: data.components ?? [],
        wires: data.wires ?? [],
        selection: [],
        waveHistory: [],
      });
      simulator.reset();
      refreshSim(true);
      get().pushLog("success", `Circuito "${data.name}" cargado (${data.components?.length ?? 0} componentes).`);
    },

    newProject: () => {
      pushUndo();
      set({ projectName: "Nuevo circuito", components: [], wires: [], selection: [], waveHistory: [] });
      simulator.reset();
      refreshSim(true);
    },

    getCircuit: () => ({
      name: get().projectName,
      components: get().components,
      wires: get().wires as never,
    }),

    synthesizeFromMinterms: (minterms, dontcares, nVars) => {
      const built = buildSopCircuit(minterms, dontcares, nVars);
      pushUndo();
      set({
        components: [...get().components, ...built.components],
        wires: [...get().wires, ...built.wires],
      });
      refreshSim();
      get().pushLog("success", `Circuito sintetizado: F = ${built.expression} (${built.components.length} componentes).`);
    },

    // ------------------------------------------------ plumbing
    afterSimRun: () => {
      const st = get();
      set({
        simVersion: st.simVersion + 1,
        pinValues: simulator.pinValues(),
        compStates: simulator.compStates(),
        drivenMap: simulator.drivenInputs(),
        waveHistory: [...simulator.history],
      });
    },
  };
});
