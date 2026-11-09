// El circuito viaja dentro del link (comprimido en el fragmento #c=...): no hace falta servidor ni base de datos.
// Todo lo que llega de un link o de un archivo es ajeno: se valida antes de cargarlo.
import { CATALOG } from "./catalog";
import type { CircuitData, ComponentDef, ComponentInstance, ComponentType, PinDef, PropField, Wire } from "./types";

const MAX_COMPRIMIDO = 200_000; // caracteres en el link
const MAX_TEXTO = 2_000_000; // JSON ya descomprimido
const MAX_PIEZAS = 2_000;
const CLAVES_PROHIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_LISTA = 65_536; // celdas de una RAM, ROM o LUT
const MAX_SUELTO = 4_096; // números que no declara el catálogo

const esTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function propsLimpias(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor)) if (!CLAVES_PROHIBIDAS.has(k)) limpio[k] = v;
  return limpio;
}

/** Valor aceptable para un campo, o undefined si no lo es. Los números se llevan a su rango. */
function valorDeCampo(f: PropField, v: unknown): unknown {
  switch (f.kind) {
    case "number":
      return esNumero(v) ? Math.min(f.max, Math.max(f.min, v)) : undefined;
    case "select":
      return f.options.some((o) => o.value === v) ? v : undefined;
    case "toggle":
      return typeof v === "boolean" ? v : undefined;
    case "text":
      return typeof v === "string" ? v.slice(0, 40) : undefined;
    case "bits":
      return Number.isSafeInteger(v) && (v as number) >= 0 ? v : undefined;
    case "custom":
      return Array.isArray(v) && v.length <= MAX_LISTA && v.every((x) => esNumero(x) || (Array.isArray(x) && x.length <= MAX_LISTA && x.every(esNumero))) ? v : undefined;
  }
}

/** Las props de un link pueden decir cualquier cosa, y de ellas sale cuántos pines y celdas se crean. */
function propsDe(def: ComponentDef, valor: unknown): Record<string, unknown> | null {
  const crudas = propsLimpias(valor);
  if (!crudas) return null;
  const props: Record<string, unknown> = { ...(def.defaults ?? {}), ...crudas };
  const declaradas = new Set<string>();
  for (const f of def.propFields ?? []) {
    declaradas.add(f.key);
    if (!Object.hasOwn(props, f.key)) continue;
    const v = valorDeCampo(f, props[f.key]);
    if (v !== undefined) props[f.key] = v;
    else if (def.defaults && Object.hasOwn(def.defaults, f.key)) props[f.key] = def.defaults[f.key];
    else delete props[f.key];
  }
  for (const [k, v] of Object.entries(props)) {
    if (declaradas.has(k)) continue;
    const suelto = typeof v === "boolean" || (typeof v === "string" && v.length <= 80) || (esNumero(v) && Math.abs(v) <= MAX_SUELTO);
    if (!suelto) delete props[k];
  }
  return props;
}

const pinesDe = (def: ComponentDef, props: Record<string, unknown>): PinDef[] => (typeof def.pins === "function" ? def.pins(props) : def.pins);
const anchoDe = (p: PinDef, props: Record<string, unknown>) => (typeof p.width === "function" ? p.width(props) : p.width);

/** Devuelve un circuito con forma válida, o null si los datos no lo son. */
export function validarCircuito(datos: unknown): CircuitData | null {
  if (typeof datos !== "object" || datos === null) return null;
  const { name, components, wires } = datos as Record<string, unknown>;
  if (!Array.isArray(components) || !Array.isArray(wires)) return null;
  if (components.length > MAX_PIEZAS || wires.length > MAX_PIEZAS * 4) return null;

  const piezas: ComponentInstance[] = [];
  const ids = new Set<string>();
  for (const c of components as Record<string, unknown>[]) {
    if (typeof c !== "object" || c === null) return null;
    if (!esTexto(c.id) || ids.has(c.id) || !esTexto(c.type) || !Object.hasOwn(CATALOG, c.type)) return null;
    const props = propsDe(CATALOG[c.type as ComponentType], c.props);
    if (!esNumero(c.x) || !esNumero(c.y) || !props) return null;
    ids.add(c.id);
    piezas.push({
      id: c.id,
      type: c.type as ComponentType,
      x: c.x,
      y: c.y,
      props,
      label: typeof c.label === "string" ? c.label.slice(0, 80) : undefined,
    });
  }

  const porId = new Map(piezas.map((p) => [p.id, p]));
  const idsCable = new Set<string>();
  const entradasUsadas = new Set<string>();
  const cables: Wire[] = [];
  for (const w of wires as Record<string, unknown>[]) {
    if (typeof w !== "object" || w === null) return null;
    if (!esTexto(w.id) || !esTexto(w.fromPin) || !esTexto(w.toPin)) return null;
    if (!esTexto(w.fromComponent) || !esTexto(w.toComponent)) return null;
    const origen = porId.get(w.fromComponent);
    const destino = porId.get(w.toComponent);
    if (!origen || !destino || origen === destino || idsCable.has(w.id)) return null;
    // Las mismas reglas que al conectar a mano: de salida a entrada, mismo ancho, un solo cable por entrada.
    const ps = pinesDe(CATALOG[origen.type], origen.props).find((p) => p.id === w.fromPin);
    const pd = pinesDe(CATALOG[destino.type], destino.props).find((p) => p.id === w.toPin);
    const entrada = `${w.toComponent}:${w.toPin}`;
    if (!ps || !pd || ps.direction !== "output" || pd.direction !== "input" || entradasUsadas.has(entrada)) return null;
    if (anchoDe(ps, origen.props) !== anchoDe(pd, destino.props)) return null;
    idsCable.add(w.id);
    entradasUsadas.add(entrada);
    cables.push({ id: w.id, fromComponent: w.fromComponent, fromPin: w.fromPin, toComponent: w.toComponent, toPin: w.toPin });
  }

  return { name: typeof name === "string" ? name.slice(0, 120) : "Sin título", components: piezas, wires: cables };
}

const aBase64Url = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deBase64Url = (t: string) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function transformar(entrada: Uint8Array, flujo: CompressionStream | DecompressionStream, limite: number) {
  const salida = new Blob([entrada as BlobPart]).stream().pipeThrough(flujo as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const lector = salida.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > limite) {
      await lector.cancel();
      throw new Error("demasiado grande");
    }
    partes.push(value);
  }
  const unido = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    unido.set(p, i);
    i += p.length;
  }
  return unido;
}

/** Arma el fragmento "c=..." para un circuito, o null si no entra en un link. */
export async function circuitoAFragmento(c: CircuitData): Promise<string | null> {
  const crudo = new TextEncoder().encode(JSON.stringify(c));
  const comprimido = await transformar(crudo, new CompressionStream("deflate-raw"), MAX_TEXTO);
  const texto = aBase64Url(comprimido);
  return texto.length > MAX_COMPRIMIDO ? null : `c=${texto}`;
}

/** Lee un circuito del fragmento de la dirección. null si no hay; lanza un error si está dañado. */
export async function fragmentoACircuito(fragmento: string): Promise<CircuitData | null> {
  const m = /^#?c=([A-Za-z0-9_-]+)$/.exec(fragmento);
  if (!m) return null;
  if (m[1].length > MAX_COMPRIMIDO) throw new Error("link demasiado largo");
  const crudo = await transformar(deBase64Url(m[1]), new DecompressionStream("deflate-raw"), MAX_TEXTO);
  const circuito = validarCircuito(JSON.parse(new TextDecoder().decode(crudo)));
  if (!circuito) throw new Error("circuito inválido");
  return circuito;
}
