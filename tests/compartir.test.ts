// El link compartido: ida y vuelta, y que nada ajeno o dañado llegue a cargarse. Más la pieza Constante, que no tenía pin.
import { circuitoAFragmento, fragmentoACircuito, validarCircuito } from "../src/lib/circuit/compartir";
import { EXAMPLES } from "../src/lib/circuit/examples";
import { getDef } from "../src/lib/circuit/catalog";

let fallas = 0;
const ok = (nombre: string, cond: boolean) => {
  console.log(`  ${cond ? "ok" : "FALLA"}  ${nombre}`);
  if (!cond) fallas++;
};
const rechaza = async (nombre: string, f: () => Promise<unknown>) => {
  let lanzo = false;
  try {
    await f();
  } catch {
    lanzo = true;
  }
  ok(nombre, lanzo);
};

async function main() {
  console.log("ida y vuelta");
  for (const e of EXAMPLES) {
    const c = e.build();
    const f = await circuitoAFragmento(c);
    const v = f ? await fragmentoACircuito(`#${f}`) : null;
    ok(`${e.id} (${f?.length} caracteres)`, !!v && JSON.stringify(v.components.map((x) => x.id)) === JSON.stringify(c.components.map((x) => x.id)) && v.wires.length === c.wires.length);
  }

  const base = () => ({
    name: "x",
    components: [{ id: "a", type: "AND", x: 0, y: 0, props: {} }],
    wires: [] as unknown[],
  });
  console.log("validación");
  ok("circuito correcto pasa", validarCircuito(base()) !== null);
  ok("null", validarCircuito(null) === null);
  ok("sin listas", validarCircuito({ name: "x" }) === null);
  ok("tipo inexistente", validarCircuito({ ...base(), components: [{ id: "a", type: "RM_RF", x: 0, y: 0, props: {} }] }) === null);
  ok("tipo heredado de Object", validarCircuito({ ...base(), components: [{ id: "a", type: "constructor", x: 0, y: 0, props: {} }] }) === null);
  ok("coordenada no numérica", validarCircuito({ ...base(), components: [{ id: "a", type: "AND", x: "0", y: 0, props: {} }] }) === null);
  ok("id repetido", validarCircuito({ ...base(), components: [base().components[0], base().components[0]] }) === null);
  ok("cable a pieza inexistente", validarCircuito({ ...base(), wires: [{ id: "w", fromComponent: "a", fromPin: "out", toComponent: "z", toPin: "in0" }] }) === null);
  ok("demasiadas piezas", validarCircuito({ ...base(), components: Array.from({ length: 2001 }, (_, i) => ({ id: `p${i}`, type: "AND", x: 0, y: 0, props: {} })) }) === null);
  const conProto = validarCircuito(JSON.parse('{"name":"x","wires":[],"components":[{"id":"a","type":"AND","x":0,"y":0,"props":{"__proto__":{"sucio":1},"nIn":2}}]}'));
  ok("__proto__ en props se descarta", !!conProto && !Object.prototype.hasOwnProperty.call(conProto.components[0].props, "__proto__") && conProto.components[0].props.nIn === 2 && ({} as Record<string, unknown>).sucio === undefined);

  console.log("valores de props");
  for (const e of EXAMPLES) {
    const c = e.build();
    const v = validarCircuito(JSON.parse(JSON.stringify(c)));
    const iguales = !!v && c.components.every((x, i) => Object.entries(x.props).every(([k, val]) => JSON.stringify(v.components[i].props[k]) === JSON.stringify(val)));
    ok(`${e.id}: la validación no altera sus props`, iguales);
  }
  const uno = (type: string, props: unknown) => validarCircuito({ name: "x", wires: [], components: [{ id: "a", type, x: 0, y: 0, props }] })?.components[0].props;
  const pinesCon = (type: string, props: unknown) => {
    const p = uno(type, props)!;
    const d = getDef(type as never)!;
    return (typeof d.pins === "function" ? d.pins(p) : d.pins).length;
  };
  ok("AND con mil millones de entradas queda en rango", pinesCon("AND", { nIn: 1_000_000_000 }) < 64);
  ok("MUX con selector enorme queda en rango", pinesCon("MUX", { nSel: 1000, bits: 9e9 }) < 512);
  ok("DECODER con entrada de texto usa su valor por defecto", pinesCon("DECODER", { nIn: "muchas" }) < 512);
  ok("LUT con tabla que no es lista la descarta", !Array.isArray(uno("LUT", { table: "x" })?.table) || (uno("LUT", { table: "x" })?.table as unknown[]).every((n) => typeof n === "number"));

  console.log("cables de un link");
  const piezas = [
    { id: "a", type: "CONSTANT", x: 0, y: 0, props: { bits: 1, value: 1 } },
    { id: "k8", type: "CONSTANT", x: 0, y: 0, props: { bits: 8, value: 1 } },
    { id: "b", type: "NOT", x: 0, y: 0, props: {} },
  ];
  const cable = (id: string, fromComponent: string, fromPin: string, toPin = "in0", toComponent = "b") => ({ id, fromComponent, fromPin, toComponent, toPin });
  const conCables = (wires: unknown[]) => validarCircuito({ name: "x", components: piezas, wires });
  ok("cable correcto pasa", conCables([cable("w", "a", "out")]) !== null);
  ok("pin inexistente", conCables([cable("w", "a", "nada")]) === null);
  ok("anchos distintos", conCables([cable("w", "k8", "out")]) === null);
  ok("dos cables a la misma entrada", conCables([cable("w", "a", "out"), cable("v", "k8", "out")]) === null);
  ok("id de cable repetido", conCables([cable("w", "a", "out"), { ...cable("w", "a", "out"), toPin: "in1" }]) === null);
  ok("cable de entrada a salida", conCables([{ id: "w", fromComponent: "b", fromPin: "in0", toComponent: "a", toPin: "out" }]) === null);

  console.log("links dañados");
  ok("sin fragmento", (await fragmentoACircuito("#otra-cosa")) === null);
  await rechaza("base64 que no es deflate", () => fragmentoACircuito("#c=AAAAAAAA"));
  await rechaza("link demasiado largo", () => fragmentoACircuito(`#c=${"A".repeat(200_001)}`));
  const bomba = new Uint8Array(new TextEncoder().encode(" ".repeat(3_000_000)));
  const comprimida = await new Response(new Blob([bomba]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
  const b64 = Buffer.from(comprimida).toString("base64url");
  await rechaza(`bomba de descompresión (${b64.length} caracteres → 3 MB)`, () => fragmentoACircuito(`#c=${b64}`));

  console.log("pieza Constante");
  const def = getDef("CONSTANT")!;
  const pines = typeof def.pins === "function" ? def.pins(def.defaults ?? {}) : def.pins;
  ok("tiene pin de salida con id", pines.some((p) => p.id === "out" && p.direction === "output"));

  if (fallas) {
    console.log(`\n${fallas} FALLAS`);
    process.exit(1);
  }
  console.log("\nTODO OK");
}

main();
