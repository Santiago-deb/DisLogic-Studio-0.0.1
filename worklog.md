# Worklog — DisLogic

Proyecto: DisLogic — Simulador web de circuitos digitales (Diseño Lógico UTN)
Autor del prompt: Santiago Santillán

---
Task ID: 1-2-3-4 (fase fundación + canvas + shell UI)
Agent: Z.ai Code (principal)
Task: Instalar deps, construir fundación (tipos, catálogo, simulador, store, Karnaugh/QM, síntesis), canvas React Flow con nodos/cables personalizados, shell UI completa (top bar, paleta, propiedades, bottom bar, diálogos), API de compartir con Prisma.

Work Log:
- Instalado @xyflow/react@12.11.6
- src/lib/circuit/types.ts: tipos centrales (ComponentInstance, Wire, CircuitData, PinDef, EvalContext, ComponentDef, TruthTable, WaveSample, LogMessage)
- src/lib/circuit/catalog.ts: catálogo completo de ~45 componentes con eval() y truthTable() — compuertas (AND/OR/NOT/NAND/NOR/XOR/XNOR/BUFFER/TRI_STATE, nIn 2-8, negInputs), wiring (INPUT_PIN, OUTPUT_PIN, CLOCK, CONSTANT, POWER, GROUND, PROBE, TUNNEL, SPLITTER, COMBINER), plexers (MUX nSel 1-4 + bits, DMUX, DECODER nIn 2-4 + enable, ENCODER prioritario), aritmética (HA, FA, ADDER_N, SUBTRACTOR_N, ADDER_SUBTRACTOR, COMPARATOR, ALU 8 bits con flags ZCVN), secuenciales (LATCH_SR, LATCH_D, FF_D, FF_JK, FF_T, REG_PIPO, REG_UNIVERSAL, REGISTER_FILE, contadores síncronos ↑↓/async ripple, FREQ_DIVIDER), síntesis (LUT 1-6 in, ROM, PLA) y RAM. Convención: inputs undefined tratados como 0 (n()); pines clk con borde ▸; FFs detectan flanco con prevInputs.
- src/lib/circuit/simulator.ts: motor event-driven con heap binario; run(maxTime) procesa instantes de tiempo completos + resuelve túneles; detección de oscilación (MAX_EVENTS 8000); modo ideal (delay=0) y temporal (props.delay ns); toggleClock/toggleInputPin; grabación de historial para probes (MAX_HISTORY 24000); pinValues()/compStates()/drivenInputs() para la UI; peekNextTime() para Step temporal.
- src/lib/circuit/karnaugh.ts: Quine-McCluskey completo (2-4 vars, don't cares), SOP + POS vía complemento, grayOrder() para el mapa, parseMintermList().
- src/lib/circuit/synth.ts: buildSopCircuit() genera INPUT_PINs, NOTs, ANDs por término, OR final y OUTPUT_PIN desde mintérminos.
- src/lib/circuit/store.ts: store Zustand con documento (components/wires/selection), simulación (mode edit|sim, running, temporal, clockHz, pinValues, compStates, oscillating), waveform (probes, waveHistory), UI (rightTab props|kmap|wave, diálogos), undo/redo (snapshots), addComponent/connect (valida dirección + ancho, un driver por entrada)/disconnect/delete/duplicate, loadCircuit/newProject/getCircuit, autosave manejado en page.tsx.
- src/components/circuit/circuit-node.tsx: nodo con símbolos IEEE/ANSI SVG para compuertas, trapezoides para MUX/DMUX, bloques con badges de valor en vivo, Handles coloreados por valor (verde #00FF88 = 1, rojo #FF4444 = 0, gris punteado = flotante), geomoría dinámica (nodeGeometry/pinsOf exportados).
- src/components/circuit/wire-edge.tsx: edge custom con getSmoothStepPath, color por valor, animación de pulsos eléctricos con animateMotion cuando value=1 y running, etiqueta /N para buses.
- src/components/circuit/circuit-canvas.tsx: ReactFlow con Background dots, MiniMap, Controls, drag&drop desde paleta (dataTransfer "application/dislogic"), isValidConnection (valida ancho/dirección), menú contextual propio (tabla de verdad, propiedades, duplicar, eliminar), atajos Ctrl+Z/Ctrl+D/Delete, listeners de zoom dislogic:zoomin/zoomout/fit.
- src/components/panels/: palette.tsx (paleta categorizada con búsqueda), properties-panel.tsx (editores declarativos + editores custom RAM hex/LUT tabla/PLA matriz/ROM), top-bar.tsx (logo chip, nombre proyecto, toggle Edición/Simulación, Play/Pause/Step/Reset, slider CLK Hz, toggle ⏱ns temporal, undo/redo/zoom, Ejemplos/Procesador, nuevo/exportar/importar/compartir/ayuda), bottom-bar.tsx (estado + consola + footer "Diseñado por Santiago Santillán — Diseño Lógico UTN"), dialogs.tsx (TruthTable, Examples, Help, Share).
- src/app/page.tsx: layout h-screen flex-col con footer sticky (BottomBar con mt-auto), carga por ?circuit=ID, autosave localStorage.
- src/app/layout.tsx: metadata DisLogic, lang es, clase dark. globals.css: tema oscuro + scrollbar + estilos React Flow.
- prisma/schema.prisma: modelo SharedCircuit. API: POST/GET /api/circuits, GET /api/circuits/[id]. db:push OK.
- Lint OK (0 errores). GET / 200 OK.

Stage Summary:
- MVP funcional: canvas pan/zoom, paleta drag&drop, ~45 componentes simulables, cables animados, undo/redo, save/load JSON, compartir con backend.
- Contratos clave para subagentes:
  - Store: useCircuit (zustand) en src/lib/circuit/store.ts — estado: components, wires, pinValues, compStates, waveHistory (WaveSample {t,key,value}), probes, simVersion, mode/running/temporal, rightTab; acciones clave: setProbes(keys: string[]), clearWaveHistory(), pushLog(level,text), setRightTab, synthesizeFromMinterms(minterms, dontcares, nVars), addComponent, updateComponentProps, toggleInteractive, setMode, setRunning, stepSim, resetSim.
  - Karnaugh: src/lib/circuit/karnaugh.ts — minimize(minterms, dontcares, nVars, varNames?) → KResult {sop, pos, groups: KGroup[{literals, minterms, color, label}], ...}; grayOrder(n); parseMintermList(str); VAR_NAMES_4.
  - Waveform: leer store.waveHistory (array {t, key, value} ordenado, value -1 = flotante) + store.probes + simVersion para re-render; setProbes/clearWaveHistory para acciones. key = "compId:pinId"; para etiquetas usar components.find(c=>c.id===compId)?.label + pinId. t = ns en modo temporal, nº de paso en ideal.
  - Ejemplos: src/lib/circuit/examples.ts — export EXAMPLES: {id, name, module: 1|2|3|4|5, description, build: () => CircuitData}[]. La galería (dialogs.tsx) importa dinámicamente y matchea por id contra EXAMPLE_META: ids requeridos: nand-not, nand-and, mux21-gates, mux21-nand, fa, adder4, kmap-demo, lut-fa, latch-sr, ffd, counter4, divider.
  - Procesador: src/components/panels/processor-panel.tsx — export ProcessorPanel (se muestra en Dialog full-screen h-[92vh] max-w-[1200px]); puede crear src/lib/circuit/processor.ts propio; UI disponible: useCircuit((s)=>s.pushLog).
---
Task ID: 6-a
Agent: frontend-styling-expert (subagente Panel Karnaugh)
Task: Implementar el panel de la herramienta de Mapa de Karnaugh (src/components/panels/kmap-panel.tsx) reemplazando el placeholder.

Work Log:
- Leí worklog.md y los contratos existentes: karnaugh.ts (minimize/grayOrder/parseMintermList/VAR_NAMES_4, KResult/KGroup), store.ts (synthesizeFromMinterms, pushLog, RightTab), synth.ts, RightPanel en properties-panel.tsx y componentes shadcn ui disponibles.
- Reescrito kmap-panel.tsx ("use client", exporta KmapPanel) con ScrollArea, tema oscuro (#0D1420/#111826, slate-800, acento cian #00AAFF) y tipografía font-mono para expresiones.
- Entradas: Select compacto de nVars (2/3/4 → A,B,C,D), Input de mintérminos (acepta "0,1,2" o "F=Σm(...)") e Input opcional de don't cares; validación con useMemo: duplicados removidos, fuera de rango (≥ 2^n) filtrados con aviso "⚠ Fuera de rango (ignorados)", don't cares que pisan mintérminos se descartan; línea canónica F = Σm(...) + d(...) bajo los campos.
- Mapa: tabla con filas/columnas en código Gray (grayOrder: filas AB = 2 bits si nVars≥3, columnas el resto; esquina "AB\CD"); celdas de 40/44/52 px según nVars con valor 1 (verde), 0 (gris) o X (ámbar) e índice de mintérmino en esquina pequeña (text-[7px]).
- Agrupamientos: por cada KGroup se calculan las fronteras reales por celda (vecino Gray con wrap-around del mapa) y se dibuja un overlay absoluto con borde 2px del color del grupo + fondo translúcido, con bordes redondeados solo en las esquinas de la región → contornos continuos que envuelven correctamente (mapa "enrolla"). Leyenda de colores debajo: cuadrado de color + label (ej. A·B') + mintermos cubiertos.
- Resultados: SOP mínima con Badge "AND-OR-Invert" (cian), POS mínima con Badge "OR-AND" (violeta), contador de implicantes primos y esenciales; todo font-mono.
- Sección educativa con Accordion plegable: "Mintermos vs. Maxtermos" (mᵢ: fila donde F=1, único por fila, F=Σm; Mᵢ: complemento, filas en 0, F=ΠMᵢ, relación Mᵢ=(mᵢ)') y "Cómo leer el mapa" (código Gray, grupos 1/2/4/8, rol de las X).
- Botón "Sintetizar en canvas" (disabled sin unos): llama useCircuit.getState().synthesizeFromMinterms(parsed.minterms, parsed.dontcares, nVars) + pushLog con SOP/POS.
- Chips de ejemplos de final: los 5 pedidos (F={0,2,4,6,8,9,10,11,15}, {1,5,7,9,13,14,15}, {1,3,5,7,8,10,12,14}, {0,4,5,8,12,13}, {0,1,2,3,8,10,12}), cargan nVars=4 + campos.
- Interacción avanzada: clic en cualquier celda hace toggle 0→1→X→0 reescribiendo los campos de texto (fuente única de verdad); título/aria-label por celda.
- Estado vacío: sin mintérminos muestra caja punteada "Sin mintérminos" con instrucciones (el mapa sigue visible e interactivo para armar F clickeando celdas); resultados/leyenda/botón ocultos.
- Verificación: `bun run lint` → 0 errores; GET http://localhost:3000/ → 200 (hot-reload, sin reiniciar dev server). Script bun temporal validó minimize (ej. f1 → SOP A'·D' + A·B' + A·B·C·D, 11 primos / 3 esenciales), grayOrder [0,1,3,2], overlays con wrap OK, 2/3 vars, don't cares y caso vacío; luego se borró.

Stage Summary:
- KmapPanel completo y funcional en la pestaña "Karnaugh" del panel derecho: entrada validada (mintérminos + don't cares + 2-4 vars), mapa Gray con agrupamientos coloreados por fronteras (wrap-around correcto), leyenda, SOP/POS con badges, primos/esenciales, accordion educativo, 5 ejemplos de final, síntesis al canvas vía synthesizeFromMinterms y toggle 0→1→X→0 por celda. Sin cambios en APIs existentes; sin dependencias nuevas. Lint 0 errores, página 200.
---
Task ID: 6-d
Agent: Z.ai Code (subagente ejemplos)
Task: Reemplazar el placeholder src/lib/circuit/examples.ts por la galería REAL de circuitos precargados (12 ids obligatorios + 5 extras) y sumar los extras a EXAMPLE_META en dialogs.tsx.

Work Log:
- Leídos worklog.md, catalog.ts, types.ts, dialogs.tsx (EXAMPLE_META), synth.ts y simulator.ts para conocer la API exacta (pines: in0..inN/out, FULL_ADDER a0/b0/cin→sum/cout, FF_D d/clk→q/qn, FF_T t/clk→q/qn, LUT i0..i5→out, REG_PIPO d/load/clk/clr→q, ALU a/b/op0-2→out/z/c/v/n, COMBINER/SPLITTER b0..bN↔bus, PROBE in0).
- Reescrito src/lib/circuit/examples.ts: helpers mk()/conn()/inPin()/outPin() con nid() único por invocación (Date.now+contador módulo-nivel) y defaults del catálogo clonados por build(). 17 builders con layout prolijo (x espaciado ≥180px, y ≥90px).
- BUG DE BASE ENCONTRADO Y CORREGIDO en src/lib/circuit/simulator.ts (evalComp): rt.prevInputs se snapshoteaba ANTES del eval (ctx.prevInputs === ctx.inputs siempre) → NINGÚN componente edge-triggered (FF_D/FF_T/FF_JK/REG_PIPO/FREQ_DIVIDER/COUNTER_*) detectaba flancos jamás. Fix mínimo: mover el snapshot rt.prevInputs = {...rt.inputs} a DESPUÉS de def.eval(), de modo que ctx.prevInputs contenga las entradas del eval anterior (contrato que el catálogo ya asumía). Verificado con repro mínimo que FF_D ahora captura en el flanco ascendente y no captura sin flanco.
- dialogs.tsx: agregados a EXAMPLE_META los 5 extras: nand-or, dmux21, pipo8, alu-demo, jk-conversion (formato {id, name, module, description} existente).
- Suite de verificación (tool-results/test-examples.ts, corre con bun): ~60 asserts sobre el simulador real — tablas completas (fa, lut-fa, kmap 16 combos), sumas 4 bits con carry, MUX/DMUX, latch SR set/hold/reset/prohibido, FF-D con pulsos, contador 4 bits (15→14→…→0 módulo 16), divisor ÷8 (OUT=1 a los 4 pulsos), PIPO 8 bits carga 0xA5 + retención con LOAD=0, ALU 8 OPs con flags Z/N, conversión JK (set/hold/reset/toggle), unicidad de ids entre invocaciones. TODOS PASAN ✔.
- bun run lint → 0 errores. GET / → 200 (hot-reload, dev server intacto). tsc --noEmit muestra solo errores preexistentes de otros módulos (ninguno en examples.ts/dialogs.tsx).

Stage Summary:
- Galería real en src/lib/circuit/examples.ts (export EXAMPLES + ExampleCircuit sin cambios de contrato). 17 ejemplos:
  - M1: nand-not (NOT=1 NAND), nand-and (NAND+inv), nand-or (NOR+inv, De Morgan), mux21-gates (S=A·sel'+B·sel), mux21-nand (4 NAND), dmux21 (O0=D·sel', O1=D·sel), fa (2 XOR + mayoría con 3 AND+OR), adder4 (4 FULL_ADDER cout→cin + Cin/A0-3/B0-3/Sum0-3/Cout).
  - M2: kmap-demo (buildSopCircuit([0,2,4,6,8,9,10,11,15],[],4) → "F = A'·D' + A·B' + A·B·C·D (Karnaugh)", verificado F=1 exactamente en esos mintérminos), lut-fa (LUT3 Sum [0,1,1,0,1,0,0,1] + LUT3 Cout [0,0,0,1,0,1,1,1]).
  - M3: latch-sr (2 NOR cruzadas, estado prohibido S=R=1), ffd (CLOCK+FF_D withAsync:false), counter4 (4 FF_T con T=POWER, Q→CLK siguiente; verifico: cuenta 15→0 módulo 16, cada etapa ÷2), divider (CLOCK+FREQ_DIVIDER stages:3 → ÷8).
  - M4/M5: pipo8 (8 INPUT→COMBINER8→REG_PIPO8(load,clk)→SPLITTER8→8 LEDs), alu-demo (CONST 0x0F/0x03 + OP0-2 → ALU8 → PROBE hex + Z/N, mapa OP en description), jk-conversion (D=J·Q'+K'·Q con realimentación q/qn, set/hold/reset/toggle verificados).
- SIMULADOR: fix de detección de flancos en evalComp (src/lib/circuit/simulator.ts) — los secuenciales ahora responden al clock en toda la app.
- Test de regresión reutilizable: `bun tool-results/test-examples.ts`.
---
Task ID: 6-b
Agent: frontend-styling-expert (subagente Waveform Viewer)
Task: Implementar el Waveform Viewer (diagrama de tiempos estilo GTKWave) en src/components/panels/waveform-panel.tsx.

Work Log:
- Leído worklog.md y verificados los contratos: store.ts (waveHistory WaveSample{t,key,value}, probes, simVersion, pinValues, setProbes, clearWaveHistory, pushLog, temporal), types.ts (WaveSample, PinDef/Pin), simulator.ts (recordIfProbed: history push {t: this.time,...}, MAX_HISTORY 24000; en modo ideal time queda 0), circuit-node.tsx (pinsOf(type,props)→Pin[{id,name,width,direction}]), ui/select (SelectTrigger size="sm"), ui/badge (variant outline) y page.tsx (RightPanel tab "Ondas" dentro del aside w-72).
- Implementación completa en waveform-panel.tsx ("use client", export WaveformPanel), conectada ya desde page.tsx → RightPanel(wavePanel).
- Selector de señales: <Select> shadcn compacto con candidatos = pines de SALIDA de todos los componentes (más in0 de OUTPUT_PIN/PROBE por ser salidas del circuito), label "comp · pin [Nbits]"; al elegir → setProbes([...probes, key]) + pushLog; chips de probes activos con botón × → setProbes(probes.filter).
- Render SVG: eje de tiempo arriba (AXIS_H 24px) con ticks "nice" (1/2/5×10^k, ~5 ticks, clamps anti-solape), grid vertical #1E2A3C; una fila por señal ROW_H 34px con separadores; etiqueta izquierda fija (LABEL_W 104px, font-mono 9px, nombre comp + pin) y valor actual coloreado (verde #00FF88 ≠0, rojo #FF4444 =0, gris "Z" flotante).
- Trazas 1-bit: escalón con transiciones verticales (nivel alto/bajo), flotante = nivel medio punteado gris; buses (width>1): segmentos hexagonales GTKWave con fill translúcido por valor y valor en hex (0x.. si entra, dígito si es angosto); sin datos → línea punteada central.
- Eje X: en modo temporal t en ns (auto-escala a µs si ≥10µs); en modo ideal el motor registra t=0 siempre, así que se usa el nº de evento global (orden en waveHistory) como eje ("paso").
- Ventana/zoom: memoria de instantes únicos; vista "Todo" = últimos 2000 instantes, presets 1k/200/50; decimación a máx 260 segmentos por traza con stride (incluye última muestra); extensión del último nivel hasta el borde derecho; ResizeObserver mide el ancho real del plot (viewBox 1u = 1px).
- Extra: flancos de subida de CLOCKs probeados dibujados como guías verticales punteadas (útil para leer secuenciales).
- Controles: botón papelera "Limpiar historial" (clearWaveHistory + pushLog, disabled sin muestras), contador "N muestras", hint "Agregá señales y corré la simulación (▶)..."; estado vacío sin probes con Activity icon e instrucciones.
- Eficiencia: useMemo sobre (waveHistory, simVersion, temporal) para agrupar O(n) por key; compById/rows/candidates/win/clockEdges memoizados; todos los hooks antes del early-return del estado vacío (Rules of Hooks OK).
- Tema oscuro: fondo #0B111C, trazas #00FF88/#FF4444/#8B98AB, grid #1E2A3C, texto slate-400/600, valores font-mono; ScrollArea vertical para varias señales; no se instalaron paquetes nuevos.
- Verificación: bun run lint → 0 errores; curl http://localhost:3000/ → 200 (hot-reload, dev server intacto); bunx tsc --noEmit → 0 errores en waveform-panel.tsx (solo preexistentes en otros módulos).

Stage Summary:
- WaveformPanel completo y funcional en la pestaña "Ondas" del panel derecho (w-72): selector de sondas sobre salidas (y OUT/Probe), chips removibles, SVG GTKWave con escalones 1-bit, buses hexagonales con hex, flotantes punteados, eje ns/paso con ticks y guías de flanco de clock, zoom Todo/1k/200/50 con decimación, limpiar historial con log, contador de muestras y estado vacío. Sin cambios en APIs del store ni dependencias nuevas. Lint 0 errores, página 200.
---
Task ID: 6-c
Agent: Z.ai Code (subagente Procesador 8 bits)
Task: Implementar el Módulo 5 — Procesador de 8 bits de la cátedra: motor src/lib/circuit/processor.ts y UI completa src/components/panels/processor-panel.tsx (reemplazando el intento previo interrumpido y conectándolo al motor real).

Work Log:
- Leído worklog.md y verificado el placeholder processor-panel.tsx de un intento previo: la UI cumplía la estructura de la spec (3 columnas, datapath SVG, RAM hex, presets, timing, FAQ) pero importaba de un processor.ts inexistente. Se conservó/mejoró la UI y se escribió el motor completo para su contrato.
- src/lib/circuit/processor.ts (nuevo, TypeScript puro sin React):
  - ISA 8 bits: palabra [7:4] opcode · [3:1] registro ([0]=0). Opcodes NOP=0x0, LOAD, STORE, ADD, SUB, AND, OR, XOR, NOT, SHL, SHR, LOADI=0xB, JMP=0xC, JZ=0xD, HALT=0xE; LOADI/JMP/JZ de 2 palabras (opcode+reg, luego byte inmediato). Export OP, TWO_WORD_OPS, REG_ALU_OPS, decodeByte() (para el IR), h2().
  - Processor con ProcessorState (pc, ir, irValid, acc, regs[8], ram[256], flags z/c/v/n, halted, cycleCount, phase, lastInstruction, log (tope 50, más reciente primero), lastReg para resaltar el banco, progLen) y ControlSignals (pcLoad, pcInc, irWrite, regWrite, memRead, memWrite, accWrite, aluOp, muxSel "",+ addrBus/ramOut/aluResult para los valores en vivo del datapath). API: loadProgram(asm)→{ok, errors:{line,msg}[], bytes}, step() (UN ciclo fetch→decode→execute), reset() (conserva RAM/programa), setRam(addr,value) (grilla editable), getSignals() (señales del último ciclo para pintar el datapath).
  - Semántica: LOAD Ri→Acc=Regs[i] (muxSel=reg) · STORE Ri→Regs[i]=Acc (regWrite) · ADD/SUB con C (carry/borrow a<b) y V (overflow signed: (a^r)&(b^r)&0x80 / (a^b)&(a^r)&0x80) · AND/OR/XOR · NOT=~Acc&0xFF · SHL/SHR con C=bit saliente · LOADI imm (muxSel=imm, lee byte en PC+1, PC+=2) · JMP/JZ (pcLoad; JZ usa el flag Z del ciclo anterior; no tomado avanza 2) · HALT detiene dejando el PC en la instrucción · opcode 0xF = inválido → halt. Toda escritura en Acc actualiza Z/N (C=0, V=0 fuera de ADD/SUB/SHL/SHR).
  - Assembler de 2 pasadas: etiquetas (name:, múltiples por línea, duplicadas → error), comentarios ; y #, mnemónicos case-insensitive, registros R0..R7, valores 0x.. / 0b.. / decimal 0..255, JMP/JZ por etiqueta o número, errores {line,msg} (desconocida, registro inválido, valor fuera de rango, etiqueta inexistente, >256 palabras); con errores no toca la RAM; al ensamblar bien escribe RAM (zero-fill) y resetea la CPU.
  - Timing de cátedra: REF_DELAYS (t_ram 4, t_mux2_8 2, t_dmux2_1 2, t_cu 3, t_add_8bits 5, t_sub_8bits 5, t_compuertas_8bits 1, t_shift 0.5, t_buffers 1, t_setup 0.25, t_prop 0.75, t_hold 0.01 ns), TIMING_TERMS del camino crítico t_prop+t_ram+t_cu+t_mux+t_ALU+t_setup → T_MIN_NS=15 ns, F_MAX_MHZ≈66.7.
- processor-panel.tsx (ajustes al intento previo): botón renombrado a "Ensamblar → RAM"; errores del assembler mostrados con "Línea N: msg" (AsmError[] tipado, fix de useState<string[]> → useState<AsmError[]> que rompía tsc); anchos según spec (izquierda w-64, derecha w-72, grilla RAM con columna de direcciones 20px); datapath: agregado el MUX de origen del PC (0:+1 del incrementador vs 1:imm del salto, trapezoide sobre el PC) y recableado del camino de inmediato (RAM→MUX PC) activado por pcLoad.
- Suite bun temporal (tool-results/test-processor.ts, luego borrada): 53 checks ✔ — suma 3+5 (Acc=8, R7=8, 6 ciclos, encodings B0 03/20/B0 05/30/2E), cuenta regresiva con etiquetas (JZ fin→D0 0D, JMP loop→C0 06, R0=0, 29 ciclos, JZ tomado con Z=1), NOT+SHL (Acc=0xE0, C=1 N=1), overflow ADD V=1, borrow SUB C=1 N=1, SHL/SHR carry+Z/N, JMP/JZ no tomado, AND/OR/XOR, opcode inválido → halt, setRam, reset conserva RAM/progLen, 5 clases de errores de assembler con línea, RAM intacta ante errores, T_MIN=15 ns y f_max≈66.67 MHz.
- Verificación: bun run lint → 0 errores; bunx tsc --noEmit → sin errores en processor.ts/processor-panel.tsx; curl http://localhost:3000/ → 200 con hot-reload (dev server sin reiniciar).

Stage Summary:
- Módulo 5 completo y funcional: motor Processor (ISA 15 opcodes con encoding [7:4]opcode/[3:1]reg, assembler de 2 pasadas con etiquetas/comentarios/errores por línea, modelo didáctico 1 step = fetch→decode→execute, señales de control del ciclo para animar el datapath, flags ZCVN) + ProcessorPanel de 3 columnas (editor assembler + presets + grilla RAM 256×8 hex editable con PC resaltado cian | datapath SVG con PC+MUX, RAM, IR, CU rosa, banco de registros 8×8, ALU con flags, Acc, caminos verdes #00FF88 con glow según señales activas | controles ▶/⏭/⟳ con velocidad 1-10 ciclos/s, log de ciclos, análisis temporal plegable con T_min≈15ns → f_max≈66.7MHz, FAQ de final en Accordion). Presets: "Suma 3+5 → R7", "Cuenta regresiva con JZ", "Demo NOT / SHL + flags". Sin cambios en el store ni otros archivos; sin dependencias nuevas.

---
Task ID: 8
Agent: Z.ai Code (principal)
Task: Integración final — fixes de UI detectados en verificación browser end-to-end, verificación completa de todos los módulos.

Work Log:
- FIX layout: paleta derecha/izquierda desbordaban sobre el footer → aside con overflow-hidden + min-h-0 en la cadena flex de Palette.
- FIX visual: cables en modo edición ahora sólidos neutros (#3D4C63) en vez de punteados flotantes (data simActive en WireEdge).
- FIX CRÍTICO BlockBody (circuit-node.tsx): los valores se buscaban con claves "q"/"in0" pero el mapa usa "compId:pinId" → LEDs de OUTPUT_PIN y puntos de estado de FF siempre apagados. Agregado prop compId y helper val(pin) con clave completa.
- FIX Dialog del procesador: max-w de shadcn ganaba → w-[min(1200px,calc(100vw-2rem))] max-w-none sm:max-w-none.
- Restaurada la atribución de React Flow (licencia Pro para ocultarla).
- Verificación browser (agent-browser) completada:
  * Contador 4 bits FF-T: Play a 2Hz → LEDs Q0-Q3 contando binario, cables verde/rojo, badges de valores en pines ✓
  * Panel Karnaugh: F=Σm(0,2,4,6,8,9,10,11,15) → mapa Gray, 3 agrupamientos coloreados, SOP "A'·D' + A·B' + A·B·C·D", POS, 11 primos/3 esenciales, chips de finales ✓
  * Waveform: probes CLK + FF-T3·Q → onda cuadrada dibujada, eje temporal, ventanas Todo/1k/200/50 ✓
  * Procesador: preset Suma 3+5 → ensamblado (8 bytes), 6 pasos → Acc=0x08, R0=0x03, R7=0x08, IR=0xE0, HALT, log de ciclos completo, datapath con rutas activas verdes ✓
  * Galería de ejemplos: 12 visibles (17 en total con scroll), Full Adder cargado y simulado A=1,B=1,Cin=0 → Sum=0, Cout=1 ✓
  * Menú contextual → tabla de verdad XOR ✓
  * Compartir: POST /api/circuits → id; link ?circuit=<id> carga desde SQLite sin localStorage ✓
  * Móvil 390×844: usable (canvas + consola, paletas ocultas por breakpoint) ✓
  * Consola del browser: sin errores (solo warning informativo de Fast Refresh histórico) ✓
- bun run lint: 0 errores, 0 warnings. GET / → 200.

Stage Summary:
- DisLogic completo y verificado end-to-end. Todos los módulos del prompt implementados y probados en browser.

---
Task ID: 7
Agent: Z.ai Code (principal)
Task: Fix error de hidratación en <body>, eliminar textos "Ejercicio Fachero" y hacer la interfaz 100% responsive mobile manteniendo desktop intacto.

Work Log:
- layout.tsx: agregado `suppressHydrationWarning` al <body> (el mismatch de className lo causaba una extensión del browser del usuario modificando atributos antes de hidratar; el fix canónico de React). Agregado `export const viewport` con width=device-width, initialScale=1, maximumScale=1, userScalable=false (evita zoom de página; React Flow maneja su propio pinch) y viewportFit=cover (respeta safe-areas iOS del footer).
- Búsqueda y eliminación de TODAS las coincidencias "Ejercicio Fachero / Ejercicio de final": examples.ts (3: comentario, name en buildPipo8, name+description en EXAMPLES entry pipo8 → ahora "Registro PIPO 8 bits" con descripción técnica) y dialogs.tsx (EXAMPLE_META pipo8). Grep final: 0 matches de ejercicio/fachero/facherito en src/.
- top-bar.tsx REESCRITO responsive: componentes compartidos extraídos (modeToggle, simControls, oscillationBadge, overflowMenu) usados por DOS layouts dentro del mismo header — Desktop `hidden md:flex h-12` fila única idéntica a la anterior; Mobile `md:hidden` en 2 filas: fila 1 (logo compacto + nombre flex-1 + badge oscilación + DropdownMenu ⋮) y fila 2 (toggle Edit/Sim con labels cortos + play/step/reset + slider CLK + Hz + ⏱ns, overflow-x-auto). Labels Edición/Simulación: `<span className="md:hidden">Edit</span><span className="hidden md:inline">Edición</span>`. Menú ⋮ contiene: Deshacer/Rehacer, Zoom +/−/Ajustar, Ejemplos, Procesador, Nuevo/Exportar/Importar/Compartir/Ayuda. CLK compactado en mobile (sin label "CLK", slider w-8) para que todo entre en 360-390px (verificado nsRight=363 ≤ 390).
- bottom-bar.tsx responsive: footer `h-[84px] flex-col sm:h-[104px] sm:flex-row`; columna de estado ahora es franja horizontal compacta en mobile (dot + modo + resumen inline C:n W:n + estable/inestable, `sm:hidden`) y la grilla 2×2 + crédito Santiago Santillán quedan `hidden sm:...` (desktop igual).
- page.tsx: 2 Sheets mobile sobre el canvas — FAB "Componentes" (bottom-14 right-3, cyan, abre Sheet left con <Palette onAdd={close}>) y FAB "Panel" (bottom-3 right-3, abre Sheet right con <RightPanel kmapPanel wavePanel> con tabs Props/Karnaugh/Ondas). Ambos `md:hidden` (desktop mantiene asides). Radix desmonta el contenido al cerrar → cero costo cuando están cerrados.
- palette.tsx: prop opcional `onAdd?: () => void` que se dispara al agregar por tap → cierra el sheet automáticamente en mobile (tap-to-add ya existía).
- dialogs.tsx: auto-fit al cargar ejemplo (`setTimeout → dispatch dislogic:fit`) — también aplica a desktop; HelpDialog con max-h-[85vh] overflow-y-auto.
- circuit-canvas.tsx: EmptyState con hint mobile-only "En mobile: tocá «Componentes» abajo a la derecha" (md:hidden).
- globals.css: @media max-width 767px — controles React Flow 36px (touch targets más grandes), tap-highlight transparent en nodos/handles/controls, halo visual en handles al presionar.
- Verificación con agent-browser: mobile 390×844 y 360×800 (sin h-scroll, FABs visibles, sheet paleta → tap AND agrega y cierra, sheet Panel con Karnaugh renderizando mapa+SOP/POS+botón sintetizar, Ondas OK, menú ⋮ completo, ejemplos → NOT con NAND → Sim → Play → "Simulando", tap en pin D del FF-D lo togglea a 1 y el clock captura → Q verde/Q' rojo, Procesador usable) + desktop 1440×900 (header fila única h=49 con 1 fila visible, labels completos, asides intactos). Console SIN errores de hidratación ni page errors (solo warnings preexistentes de React Flow attribution y aria-describedby). Lint 0 errores.

Stage Summary:
- Hidratación fixed (suppressHydrationWarning en body) + viewport mobile configurado.
- 0 referencias a "Ejercicio Fachero / ejercicio de final" (ejemplo renombrado a "Registro PIPO 8 bits").
- Mobile first-class: top bar 2 filas + menú ⋮, bottom bar compacto, FABs flotantes con Sheets para paleta (auto-close al agregar) y panel derecho (Props/Karnaugh/Ondas), auto-fit al cargar circuitos, controles RF con targets táctiles ampliados. Desktop SIN cambios visuales ni funcionales.
- Contratos nuevos: Palette acepta `onAdd?`; eventos window "dislogic:fit" reutilizados para auto-centrar tras cargar ejemplo/circuito compartido.
