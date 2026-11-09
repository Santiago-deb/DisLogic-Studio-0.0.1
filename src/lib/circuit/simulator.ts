// ============================================================
// DisLogic — Motor de simulación event-driven
// - Modo ideal: propagación instantánea con detección de oscilaciones
// - Modo temporal: cola de eventos con retardos reales en ns
// - Graba historial de señales para el waveform viewer
// ============================================================
import { CATALOG } from "./catalog";
import type { CircuitData, ComponentInstance, SignalValue } from "./types";

interface CompRuntime {
  comp: ComponentInstance;
  inputs: Record<string, SignalValue>;
  outputs: Record<string, SignalValue>;
  prevInputs: Record<string, SignalValue>;
  state: Record<string, unknown>;
}

interface SimEvent {
  time: number;
  seq: number;
  compId: string;
}

const MAX_EVENTS = 8000;
const MAX_HISTORY = 24000;

export class Simulator {
  time = 0;
  private seq = 0;
  private rts = new Map<string, CompRuntime>();
  private driver = new Map<string, { fromComponent: string; fromPin: string }>();
  private fanout = new Map<string, { toComponent: string; toPin: string }[]>();
  private heap: SimEvent[] = [];
  private inQueue = new Set<string>();
  oscillating = false;
  autoClock = false;
  probes = new Set<string>();
  history: { t: number; key: string; value: number }[] = [];
  private version = 0;

  /** reconstruye la simulación tras un cambio estructural; preserva estados de componentes existentes */
  rebuild(circuit: CircuitData) {
    const old = new Map(this.rts);
    this.rts.clear();
    this.driver.clear();
    this.fanout.clear();
    this.heap = [];
    this.inQueue.clear();
    this.oscillating = false;

    for (const comp of circuit.components) {
      const def = CATALOG[comp.type];
      if (!def) continue;
      const prev = old.get(comp.id);
      this.rts.set(comp.id, {
        comp,
        inputs: {},
        outputs: {},
        prevInputs: {},
        state: prev && prev.comp.type === comp.type ? prev.state : def.initState ? def.initState() : {},
      });
    }
    for (const w of circuit.wires) {
      const target = this.rts.get(w.toComponent);
      const source = this.rts.get(w.fromComponent);
      if (!target || !source) continue;
      this.driver.set(`${w.toComponent}:${w.toPin}`, { fromComponent: w.fromComponent, fromPin: w.fromPin });
      const key = `${w.fromComponent}:${w.fromPin}`;
      if (!this.fanout.has(key)) this.fanout.set(key, []);
      this.fanout.get(key)!.push({ toComponent: w.toComponent, toPin: w.toPin });
    }
    // arrancar: evaluar fuentes (sin entradas) y estabilizar
    for (const id of this.rts.keys()) this.schedule(id, 0);
  }

  /** programa la reevaluación de un componente */
  private schedule(compId: string, delay: number) {
    if (this.inQueue.has(compId)) return;
    this.inQueue.add(compId);
    this.heapPush({ time: this.time + Math.max(0, delay), seq: this.seq++, compId });
  }

  private heapPush(ev: SimEvent) {
    this.heap.push(ev);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].time <= this.heap[i].time) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private heapPop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let m = i;
        if (l < this.heap.length && this.heap[l].time < this.heap[m].time) m = l;
        if (r < this.heap.length && this.heap[r].time < this.heap[m].time) m = r;
        if (m === i) break;
        [this.heap[m], this.heap[i]] = [this.heap[i], this.heap[m]];
        i = m;
      }
    }
    return top;
  }

  private delayOf(compId: string): number {
    const rt = this.rts.get(compId);
    if (!rt) return 0;
    const p = rt.comp.props;
    const d = p.delay ?? p.tProp;
    return typeof d === "number" ? d : 0;
  }

  /** evalúa un componente y propaga sus cambios de salida (incluye flotantes) */
  private evalComp(compId: string) {
    const rt = this.rts.get(compId);
    if (!rt) return;
    const def = CATALOG[rt.comp.type];
    if (!def?.eval) return;

    const prevOutputs = { ...rt.outputs };

    const ctx = {
      comp: rt.comp,
      props: rt.comp.props,
      inputs: rt.inputs,
      prevInputs: rt.prevInputs,
      state: rt.state,
      outputs: rt.outputs,
      time: this.time,
      compId,
      log: () => {}, // el log contextual se conecta desde el store
    };
    // limpiar salidas (permiten flotantes)
    for (const k of Object.keys(rt.outputs)) delete rt.outputs[k];
    def.eval(ctx as Parameters<NonNullable<typeof def.eval>>[0]);
    // snapshot de entradas para la detección de flancos del PRÓXIMO eval
    // (ctx.prevInputs apunta al snapshot anterior: prevClk ≠ clk solo si hubo transición real)
    rt.prevInputs = { ...rt.inputs };

    // propagar cambios (unión de pines previos y actuales: soporta definir y flotar)
    const allPins = new Set([...Object.keys(prevOutputs), ...Object.keys(rt.outputs)]);
    for (const pinId of allPins) {
      const val = rt.outputs[pinId];
      if (prevOutputs[pinId] !== val) {
        const key = `${compId}:${pinId}`;
        this.recordIfProbed(key, val);
        const targets = this.fanout.get(key) ?? [];
        for (const t of targets) {
          const trt = this.rts.get(t.toComponent);
          if (!trt) continue;
          const oldVal = trt.inputs[t.toPin];
          trt.inputs[t.toPin] = val;
          if (oldVal !== val) this.schedule(t.toComponent, this.delayOf(t.toComponent));
        }
      }
    }
  }

  /** sincroniza túneles con la misma etiqueta */
  private syncTunnels(): boolean {
    const groups = new Map<string, string[]>();
    for (const [id, rt] of this.rts) {
      if (rt.comp.type !== "TUNNEL") continue;
      const label = (rt.comp.props.label as string) ?? (rt.comp.label as string) ?? "A";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(id);
    }
    let changed = false;
    for (const [, ids] of groups) {
      if (ids.length < 2) continue;
      let shared: SignalValue = undefined;
      for (const id of ids) {
        const rt = this.rts.get(id)!;
        const v = rt.inputs["in0"];
        if (v !== undefined) { shared = v; break; }
      }
      for (const id of ids) {
        const rt = this.rts.get(id)!;
        if (rt.outputs["out"] !== shared) {
          rt.outputs["out"] = shared;
          this.recordIfProbed(`${id}:out`, shared);
          changed = true;
          const targets = this.fanout.get(`${id}:out`) ?? [];
          for (const t of targets) {
            const trt = this.rts.get(t.toComponent);
            if (!trt) continue;
            if (trt.inputs[t.toPin] !== shared) {
              trt.inputs[t.toPin] = shared;
              this.schedule(t.toComponent, this.delayOf(t.toComponent));
            }
          }
        }
      }
    }
    return changed;
  }

  private recordIfProbed(key: string, val: SignalValue) {
    if (!this.probes.has(key)) return;
    this.history.push({ t: this.time, key, value: val === undefined ? -1 : val });
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
  }

  /**
   * Procesa eventos hasta estabilizar (ideal) o hasta maxTime (temporal).
   * Devuelve false si se detectó oscilación.
   */
  run(maxTime = Infinity): boolean {
    let processed = 0;
    let instants = 0;
    while (processed < MAX_EVENTS) {
      if (this.heap.length === 0) break;
      const t0 = this.heap[0].time;
      if (t0 > maxTime) break;
      if (++instants > MAX_EVENTS) break;
      // procesar todos los eventos simultáneos de este instante
      while (this.heap.length > 0 && this.heap[0].time === t0 && processed < MAX_EVENTS) {
        const ev = this.heapPop()!;
        this.evalEv(ev);
        processed++;
      }
      // resolver túneles hasta estabilizar en este instante
      let tg = 0;
      while (this.syncTunnels() && tg++ < 50) {
        while (this.heap.length > 0 && this.heap[0].time === t0 && processed < MAX_EVENTS) {
          const ev = this.heapPop()!;
          this.evalEv(ev);
          processed++;
        }
      }
    }
    if (processed >= MAX_EVENTS) {
      this.oscillating = true;
      return false;
    }
    this.version++;
    return true;
  }

  /** próximo instante de evento pendiente (para Step en modo temporal) */
  peekNextTime(): number | null {
    return this.heap.length > 0 ? this.heap[0].time : null;
  }

  private evalEv(ev: SimEvent) {
    this.time = ev.time;
    this.inQueue.delete(ev.compId);
    const rt = this.rts.get(ev.compId);
    if (!rt) return;
    this.evalComp(ev.compId);
    // reprogramar clocks en modo automático temporal
    if (this.autoClock && rt.comp.type === "CLOCK") {
      const period = (rt.comp.props.periodNs as number) ?? 100;
      this.scheduleClockToggle(ev.compId, period / 2);
    }
  }

  /** alterna el nivel de un clock (modo ideal / paso manual) */
  toggleClock(compId: string) {
    const rt = this.rts.get(compId);
    if (!rt) return;
    rt.state.level = ((rt.state.level as number) ?? 0) === 1 ? 0 : 1;
    this.schedule(compId, 0);
  }

  scheduleClockToggle(compId: string, delay: number) {
    this.schedule(compId, delay);
  }

  /** alterna un pin de entrada (INPUT_PIN) */
  toggleInputPin(compId: string) {
    const rt = this.rts.get(compId);
    if (!rt) return;
    rt.state.value = ((rt.state.value as number) ?? 0) === 1 ? 0 : 1;
    this.schedule(compId, 0);
  }

  setComponentState(compId: string, key: string, value: unknown) {
    const rt = this.rts.get(compId);
    if (!rt) return;
    rt.state[key] = value;
    this.schedule(compId, 0);
  }

  setComponentProps(compId: string, props: Record<string, unknown>) {
    const rt = this.rts.get(compId);
    if (!rt) return;
    rt.comp.props = props;
    this.schedule(compId, 0);
  }

  /** reinicia estados secuenciales y tiempo */
  reset() {
    for (const [id, rt] of this.rts) {
      const def = CATALOG[rt.comp.type];
      rt.state = def?.initState ? def.initState() : {};
      rt.inputs = {};
      rt.outputs = {};
      rt.prevInputs = {};
      this.schedule(id, 0);
    }
    this.heap = [];
    this.inQueue.clear();
    this.time = 0;
    this.seq = 0;
    this.oscillating = false;
    this.history = [];
    for (const id of this.rts.keys()) this.schedule(id, 0);
    this.version++;
  }

  clearHistory() {
    this.history = [];
    this.version++;
  }

  setProbes(keys: string[]) {
    this.probes = new Set(keys);
  }

  /** valores actuales de todos los pines: "compId:pinId" → valor */
  pinValues(): Record<string, SignalValue> {
    const out: Record<string, SignalValue> = {};
    for (const [id, rt] of this.rts) {
      for (const [pin, v] of Object.entries(rt.outputs)) out[`${id}:${pin}`] = v;
      for (const [pin, v] of Object.entries(rt.inputs)) out[`${id}:${pin}`] = v;
    }
    return out;
  }

  /** mapa "compId:pinId" → el pin de entrada tiene driver conectado */
  drivenInputs(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [key, drv] of this.driver) {
      const source = this.rts.get(drv.fromComponent);
      out[key] = source !== undefined;
    }
    return out;
  }

  /** estados internos expuestos (RAM, registros, contadores, FFs…) */
  compStates(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const [id, rt] of this.rts) out[id] = rt.state;
    return out;
  }

  /** valor de un pin de salida específico (para colorear cables) */
  pinValue(compId: string, pinId: string): SignalValue {
    return this.rts.get(compId)?.outputs[pinId];
  }

  get simVersion(): number {
    return this.version;
  }
}

import type { PinDef } from "./types";
function defPins(def: { pins: PinDef[] | ((props: Record<string, unknown>) => PinDef[]) }, comp: ComponentInstance): PinDef[] {
  return typeof def.pins === "function" ? def.pins(comp.props) : def.pins;
}
