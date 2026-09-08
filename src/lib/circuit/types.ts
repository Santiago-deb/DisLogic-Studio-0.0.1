// ============================================================
// DisLogic — Tipos centrales del circuito
// Santiago Santillán — Diseño Lógico UTN
// ============================================================

/** Valor de señal: número (bus de N bits) o undefined = flotante / sin conectar */
export type SignalValue = number | undefined;

export type PinDirection = "input" | "output";

export interface PinDef {
  id: string;
  name: string;
  direction: PinDirection;
  /** ancho en bits (1 = cable simple) */
  width: number | ((props: Record<string, unknown>) => number);
}

export interface Pin extends PinDef {
  width: number;
}

export type CategoryId =
  | "gates"
  | "wiring"
  | "plexers"
  | "arithmetic"
  | "sequential"
  | "synthesis"
  | "processor";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: string;
  color: string;
}

export type ComponentType =
  // Compuertas
  | "AND"
  | "OR"
  | "NOT"
  | "NAND"
  | "NOR"
  | "XOR"
  | "XNOR"
  | "BUFFER"
  | "TRI_STATE_BUFFER"
  // Conexión
  | "INPUT_PIN"
  | "OUTPUT_PIN"
  | "CLOCK"
  | "CONSTANT"
  | "POWER"
  | "GROUND"
  | "PROBE"
  | "TUNNEL"
  | "SPLITTER"
  | "COMBINER"
  // Plexers
  | "MUX"
  | "DMUX"
  | "DECODER"
  | "ENCODER"
  // Aritmética
  | "HALF_ADDER"
  | "FULL_ADDER"
  | "ADDER_N"
  | "SUBTRACTOR_N"
  | "ADDER_SUBTRACTOR"
  | "COMPARATOR"
  | "ALU"
  // Secuenciales — latches
  | "LATCH_SR"
  | "LATCH_D"
  // Secuenciales — flip-flops
  | "FF_D"
  | "FF_JK"
  | "FF_T"
  // Registros
  | "REG_PIPO"
  | "REG_UNIVERSAL"
  | "REGISTER_FILE"
  // Contadores
  | "COUNTER_SYNC_UP"
  | "COUNTER_SYNC_DOWN"
  | "COUNTER_ASYNC"
  | "FREQ_DIVIDER"
  // Síntesis
  | "PLA"
  | "ROM"
  | "LUT"
  // Procesador
  | "RAM";

export interface ComponentInstance {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  label?: string;
  props: Record<string, unknown>;
}

export interface Wire {
  id: string;
  fromComponent: string;
  fromPin: string;
  toComponent: string;
  toPin: string;
}

export interface CircuitData {
  name: string;
  components: ComponentInstance[];
  wires: Wire[];
}

// ---------- Propiedades declarativas (panel derecho) ----------

export type PropField =
  | { kind: "select"; key: string; label: string; options: { value: number | string | boolean; label: string }[] }
  | { kind: "number"; key: string; label: string; min: number; max: number; step: number; suffix?: string }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "text"; key: string; label: string }
  | { kind: "bits"; key: string; label: string } // valor numérico mostrado en binario
  | { kind: "custom"; key: string; label: string }; // editor especial (RAM, PLA, LUT, ROM)

export interface TruthTable {
  headers: string[];
  rows: string[][];
  note?: string;
}

// ---------- Contexto de evaluación del simulador ----------

export interface EvalContext {
  comp: ComponentInstance;
  props: Record<string, unknown>;
  /** valores actuales de los pines de entrada (pinId → valor) */
  inputs: Record<string, SignalValue>;
  /** valores de entrada en la evaluación anterior (detección de flancos) */
  prevInputs: Record<string, SignalValue>;
  /** estado interno persistente del componente (mutable) */
  state: Record<string, unknown>;
  /** escribir aquí los valores de salida (pinId → valor) */
  outputs: Record<string, SignalValue>;
  /** tiempo actual de simulación (ns en modo temporal, paso # en modo ideal) */
  time: number;
  /** registrar mensaje en el log */
  log: (level: "info" | "warn" | "error", msg: string) => void;
  compId: string;
}

/** Definición completa de un componente del catálogo */
export interface ComponentDef {
  type: ComponentType;
  label: string;
  short: string;
  category: CategoryId;
  description: string;
  defaults: Record<string, unknown>;
  propFields?: PropField[];
  pins: PinDef[] | ((props: Record<string, unknown>) => PinDef[]);
  /** ¿cambia de valor al hacer clic en modo simulación? */
  clickable?: boolean;
  eval?: (ctx: EvalContext) => void;
  /** estado interno inicial */
  initState?: () => Record<string, unknown>;
  truthTable?: (props: Record<string, unknown>) => TruthTable | null;
  /** muestra "F = ..." en tooltip / panel */
  equation?: (props: Record<string, unknown>) => string | null;
}

// ---------- Registro de la consola ----------

export interface LogMessage {
  id: number;
  time: string;
  level: "info" | "warn" | "error" | "success";
  text: string;
}

// ---------- Waveform ----------

export interface WaveSample {
  t: number;
  key: string; // "compId:pinId"
  value: number; // -1 = flotante
}

export interface ProbeSignal {
  key: string; // "compId:pinId"
  compId: string;
  pinId: string;
  label: string;
  width: number;
}
