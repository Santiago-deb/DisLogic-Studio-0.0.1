# 🔌 DISLOGIC — Super Prompt para Generación de App Web de Simulación de Circuitos Digitales

**Proyecto:** DisLogic  
**Autor:** Santiago Santillán  
**Curso base:** Diseño Lógico (Electrónica Digital) — UTN  
**Fecha de generación:** Septiembre 2026

---

## 📋 CONTEXTO Y OBJETIVO

Sos un agente de IA experto en desarrollo web fullstack, diseño de interfaces y electrónica digital. Tu tarea es crear **DisLogic**, una aplicación web completa, intuitiva, moderna y visualmente impactante que permita **diseñar, simular e interactuar con circuitos digitales** — desde compuertas básicas hasta un procesador completo de 8 bits.

La app debe cubrir **todo** el contenido teórico y práctico del curso universitario de Diseño Lógico (Electrónica Digital), organizado en 5 módulos:

1. **Módulo 1:** Introducción a Sistemas Digitales (compuertas, álgebra de Boole, síntesis lógica)
2. **Módulo 2:** Síntesis Lógica (minimización Karnaugh, tecnologías de implementación: PLA, ROM, FPGA)
3. **Módulo 3:** Circuitos Secuenciales (latches, flip-flops, registros, contadores)
4. **Módulo 4:** Tiempos (propagación, setup, hold, período mínimo de reloj, frecuencia máxima)
5. **Módulo 5:** Procesador (datapath, unidad de control, ALU, banco de registros, memoria RAM)

---

## 🎨 DISEÑO Y UX — REQUERIMIENTOS GENERALES

### Identidad Visual
- **Nombre:** DisLogic
- **Tema:** Oscuro con acentos en azul eléctrico (#00AAFF), verde neón (#00FF88) para señales activas (1), y rojo (#FF4444) para señales inactivas (0)
- **Tipografía:** Monoespaciada para valores binarios/hexadecimales (JetBrains Mono o similar); Sans-serif limpia para UI (Inter, Geist)
- **Logo:** Chip estilizado con el texto "DisLogic" integrado
- **Footer:** "Diseñado por Santiago Santillán — Diseño Lógico UTN"

### Layout General
- **Canvas central** infinito (pannable y zoomable) para el circuito — tipo Figma/Logisim
- **Sidebar izquierda** con paleta de componentes organizados por categoría (drag & drop)
- **Panel derecho** contextual: propiedades del componente seleccionado
- **Barra superior:** nombre del proyecto, botones de simulación (Play/Pause/Step/Reset), zoom controls, modo de edición/simulación
- **Barra inferior:** log de errores, estado de simulación, valores de señales seleccionadas

### Animaciones y Feedback Visual
- **Flujo de señales:** Cuando la simulación está activa, las señales deben mostrarse fluyendo por los cables con animación (pulsos que viajan por los wires, estilo eléctrico)
- **Transiciones de estado:** Los flip-flops y latches deben mostrar una animación suave al cambiar de estado (glow + transición de color)
- **Propagación de retardo:** Modo avanzado donde se visualiza la propagación de las señales con delay realista (las señales "viajan" por el circuito mostrando los retardos de cada compuerta)
- **Hover effects:** Al pasar el mouse sobre un componente, se debe iluminar y mostrar tooltip con su tabla de verdad o función
- **Conexión de cables:** Al arrastrar un cable desde un pin de salida, los pines de entrada compatibles deben iluminarse (snap magnético)
- **Errores:** Cables desconectados, cortocircuitos o loops infinitos deben marcarse con animación pulsante roja
- **Clock animation:** La señal de reloj debe tener una animación de onda cuadrada visible y configurable

---

## 🧱 MÓDULO 1: COMPONENTES COMBINACIONALES BÁSICOS

### 1.1 Compuertas Lógicas Básicas
Implementar las siguientes compuertas como bloques arrastrables con cantidad configurable de entradas (2 a 8):

| Compuerta | Símbolo | Entradas | Salida |
|-----------|---------|----------|--------|
| **AND** | Forma D con línea recta | N | 1 |
| **OR** | Forma curvada | N | 1 |
| **NOT** (Inversor) | Triángulo + burbuja | 1 | 1 |
| **NAND** | AND + burbuja | N | 1 |
| **NOR** | OR + burbuja | N | 1 |
| **XOR** | OR + línea curva extra | 2 | 1 |
| **XNOR** | XOR + burbuja | 2 | 1 |
| **Buffer** | Triángulo | 1 | 1 |
| **Buffer Tri-estado** | Triángulo + enable | 2 (dato + enable) | 1 |

**Cada compuerta debe:**
- Mostrar su tabla de verdad al hacer clic derecho → "Ver tabla de verdad"
- Permitir negar entradas individuales (burbuja en pin de entrada)
- Tener un indicador visual de su valor de salida actual (color verde = 1, rojo = 0)
- Tener configuración de **tiempo de retardo** (ns) para modo de análisis temporal
- Los símbolos deben seguir el estándar IEEE/ANSI (forma distintiva) y opcionalmente IEC (rectangular)

### 1.2 Cables y Conexiones (Wiring)
- **Cable simple** (1 bit): línea que conecta un pin de salida a uno o más pines de entrada
- **Bus** (N bits): cable grueso que transporta múltiples bits; el ancho se muestra como etiqueta (ej: "/8")
- **Splitter/Combiner:** Divide un bus en señales individuales o combina señales en un bus
- **Pin de entrada:** Interruptor toggle (0/1) clickeable
- **Pin de salida:** LED indicador (verde/rojo)
- **Constante:** Bloque que emite un valor fijo configurable (0, 1, o valor de N bits)
- **Power / Ground:** Nodos de alimentación y tierra
- **Probe/Sonda:** Muestra el valor actual de un cable en tiempo real
- **Túnel/Label:** Conecta señales a distancia usando nombres (evita cables largos)
- **Clock (Reloj):** Genera una señal periódica cuadrada con frecuencia configurable

### 1.3 Multiplexores (MUX)
- **MUX 2:1** — 2 entradas de datos, 1 selector, 1 salida
- **MUX 4:1** — 4 entradas de datos, 2 selectores, 1 salida
- **MUX 8:1** — 8 entradas de datos, 3 selectores, 1 salida
- **MUX 16:1** — 16 entradas de datos, 4 selectores, 1 salida
- **MUX N-bit de ancho** (ej: MUX 2:1 de 4 bits, MUX 2:1 de 8 bits) — Las entradas y salida son buses de N bits
- Todos los MUX deben ser configurables en:
  - Número de entradas de selección
  - Ancho de datos (1 bit, 4 bits, 8 bits, etc.)
- **Mostrar la ecuación lógica** del MUX al hacer clic derecho
- Permitir construir MUX mayores a partir de MUX menores (composición jerárquica)

### 1.4 Demultiplexores (DMUX)
- **DMUX 1:2** — 1 entrada, 1 selector, 2 salidas
- **DMUX 1:4** — 1 entrada, 2 selectores, 4 salidas
- **DMUX 1:8** — 1 entrada, 3 selectores, 8 salidas
- Configurables en ancho de datos
- Permitir construir DMUX mayores a partir de DMUX 1:2 (como se pide en finales: "DMUX8_4 a partir de DMUX2_1")

### 1.5 Decodificadores (DECODE)
- **Decoder 2 a 4** — 2 entradas, 4 salidas (una activa a la vez)
- **Decoder 3 a 8** — 3 entradas, 8 salidas
- **Decoder 4 a 16** — 4 entradas, 16 salidas
- Con/sin enable
- Permitir construir decodificadores a partir de DMUX (como se pide: "DECODE3 a partir de DMUX2_1")
- Implementación con buffers tri-estado para MUX (ej: "MUX8_3 con Decodificadores y Buffers tri-estado")

### 1.6 Codificadores (Encoder)
- **Encoder 4:2**
- **Encoder 8:3**
- **Priority Encoder** — con entrada de prioridad

### 1.7 Circuitos Aritméticos

#### Half Adder (HA)
- 2 entradas (A, B), 2 salidas (Sum, Carry)
- Implementado internamente con XOR (Sum) y AND (Carry)
- Mostrar circuito interno al hacer doble clic

#### Full Adder (FA)
- 3 entradas (A, B, Cin), 2 salidas (Sum, Cout)
- Implementación con función mayoría para Cout: `Cout = AB + ACin + BCin`
- Implementación alternativa: con XOR y AND en cascada
- **Crucial:** Permitir encadenar FAs para crear sumadores de N bits (Ripple Carry Adder)
- Implementar FA usando solo NAND (como se pide en finales)

#### Sumador de N bits (Ripple Carry Adder)
- Configurable: 1, 2, 3, 4, 8, 16, 32, 64 bits
- Encadenamiento visible de Full Adders con carry chain
- Carry-in del primer FA
- **Cálculo de carry basado en carry chain vs función mayoría** — visualizar la diferencia de tiempo de propagación (se pregunta en finales)

#### Restador de N bits
- Basado en complemento a 2 (inversor + sumador con Cin=1)
- Restador completo de 1 bit (del procesador de cátedra)
- Detección de overflow para números con signo y sin signo

#### Sumador/Restador combinado
- Con señal de control SUB que selecciona operación
- Detección de overflow

#### Sumador Secuencial
- Sumador de 8 bits usando solo 2 FAs de 1 bit (opera en 4 ciclos de reloj)
- Sumador de 8 bits usando 4 FAs de 1 bit (opera en 2 ciclos de reloj)
- Cálculo de período mínimo de reloj, frecuencia máxima, y número de ciclos

#### Comparador
- Compara dos números de N bits
- Salidas: Mayor, Menor, Igual

### 1.8 Unidad Aritmético-Lógica (ALU)
- **ALU de 8 bits** con las siguientes operaciones (configurable por opcode de 3 bits):
  - Suma (A + B)
  - Resta (A - B)
  - AND bit a bit
  - OR bit a bit
  - XOR bit a bit
  - NOT (complemento de A)
  - Shift left (desplazamiento a izquierda)
  - Shift right (desplazamiento a derecha)
- **Flags de salida:**
  - Zero (Z): resultado es cero
  - Carry (C): acarreo
  - Overflow (V): desbordamiento
  - Negative (N): bit más significativo del resultado
- Implementar shifters con ancho configurable

---

## 🧪 MÓDULO 2: SÍNTESIS LÓGICA Y TECNOLOGÍAS DE IMPLEMENTACIÓN

### 2.1 Herramienta de Minimización — Mapa de Karnaugh
Incluir una herramienta integrada que:
- Acepte una función booleana como **lista de mintérminos** (ej: F = {0, 1, 2, 3, 8, 10, 12}) o como expresión algebraica
- Genere automáticamente el **mapa de Karnaugh** para 2, 3 o 4 variables
- Muestre los **agrupamientos** (implicantes primos) con colores distintos
- Produzca la **expresión mínima en SOP** (Sum of Products / AND-OR-Invert)
- Produzca la **expresión mínima en POS** (Product of Sums)
- Permita la síntesis directa: generar el circuito correspondiente en el canvas
- Soporte **don't cares** (condiciones indiferentes)
- Explicar la diferencia entre **mintérminos y maxtérminos** (concepto de final)

### 2.2 Síntesis AND-OR-Invert (ANDORI)
- Dado un conjunto de mintérminos, generar automáticamente:
  1. La minimización por Karnaugh
  2. El circuito con compuertas AND seguidas de una OR (forma canónica disyuntiva)
  3. El circuito equivalente usando solo NAND
  4. El circuito equivalente usando solo NOR
- Ejemplos de finales a soportar:
  - F = {0, 2, 4, 6, 8, 9, 10, 11, 15}
  - F = {1, 5, 7, 9, 13, 14, 15}
  - F = {1, 3, 5, 7, 8, 10, 12, 14}
  - F = {0, 4, 5, 8, 12, 13}
  - F = {0, 1, 2, 3, 8, 10, 12}

### 2.3 PLA (Programmable Logic Array)
Componente PLA configurable con:
- **Plano AND programable:** N entradas → M líneas de producto (AND terms)
- **Plano OR programable:** M líneas de producto → P salidas
- Editor visual de la **matriz de conexiones** (puntos de fusible)
- Ejemplo del curso: PLA con 5 entradas y 16 líneas AND → 16 entradas OR → 2 salidas
- Las preguntas de final incluyen:
  - "¿Con este PLA se puede implementar cualquier función de 5 variables?" → Depende del número de AND terms
  - "¿Se pueden implementar dos funciones de 3 variables?" → Sí, si las AND terms son suficientes
  - Implementar Latch SR basado en NOR usando solo un PLA
- Visualización interactiva de cómo los fusibles conectan entradas con líneas AND y líneas AND con salidas OR

### 2.4 ROM (Read-Only Memory)
- **ROM configurable:** número de celdas × ancho de palabra
- Ejemplos del curso:
  - ROM de 4 celdas de 1 bit
  - ROM de 4 celdas de 8 bits
  - ROM de 8 celdas de 6 bits
  - ROM de 8 celdas (genérica)
- Editor visual del contenido de la ROM (tabla editable)
- Preguntas clave del curso:
  - "¿Cuántas celdas se necesitan para implementar un mintérmino?" → 1 celda por mintérmino
  - "¿Cuántas celdas para un maxtérmino?" → (2^n - 1) celdas
  - Implementar sumador de 2 operandos de 2 bits usando ROM de 8 celdas de 6 bits + MUX
  - Sintetizar funciones F y G usando ROM + MUX

### 2.5 FPGA — Slices y LUTs
Este es un tema **central** del curso. Implementar:

#### LUT (Look-Up Table)
- **LUT6:** Tabla de verdad de 6 entradas → 1 salida (64 bits de configuración)
- **LUT5:** 5 entradas → 1 salida (32 bits de configuración)
- Editor visual del contenido de la LUT (puede implementar CUALQUIER función booleana de hasta 6 variables)
- Al hacer doble clic, mostrar la tabla de verdad completa y la expresión booleana resultante

#### Slice de FPGA
- Cada Slice contiene:
  - **2 LUT6** (LUT-A y LUT-B)
  - **2 MUX** (uno por cada LUT, para combinar LUTs)
  - **2 Flip-Flops** (uno por cada salida, bypass opcional)
  - **Carry chain** (para aritmética rápida)
  - **Lógica de interconexión programable**
- Visualizar el esquema interno del Slice con todos sus componentes
- Permitir configurar cada elemento del Slice individualmente

#### Ejercicios de FPGA que aparecen en finales:
- Sintetizar un **sumador completo de 4 bits** con máximo 5 LUTs (sin MUX)
- Sintetizar un **MUX8_1** usando solo Slices de FPGA
- Sintetizar un **MUX8_4** en LUTs (especificar función lógica de cada LUT)
- Sintetizar un **MUX4_4** en LUTs
- Sintetizar un **Latch SR síncrono con preset asíncrono** en Slices (detallando LUTs)
- Sintetizar un **Latch D con reset asíncrono** en Slices
- Sintetizar un **FF-D basado en Latch D** en Slices
- Sintetizar un **sumador de 3 bits** usando solo 3 LUTs
- "Considerando 6 Slices, ¿cuál es el máximo número de variables que puede tener una función?" → 6 LUTs × 6 entradas con interconexión

---

## 🔄 MÓDULO 3: CIRCUITOS SECUENCIALES

### 3.1 Latches

#### Latch SR (Set-Reset)
- Implementación con compuertas **NOR** (activo en alto)
- Implementación con compuertas **NAND** (activo en bajo)
- Estado prohibido visible (cuando S=R=1 en NOR o S=R=0 en NAND)
- Animación de metaestabilidad al entrar en estado prohibido
- Tabla de estados completa

#### Latch SR Síncrono
- Latch SR + señal de Clock/Enable
- Con preset asíncrono (implementable en FPGA)

#### Latch D (Data)
- Basado en Latch SR con inversor
- Captura dato mientras Clock=1, retiene mientras Clock=0 (level-triggered)
- Con reset asíncrono

#### Latch T (Toggle)
- **Pregunta de final:** "¿Tiene sentido la implementación de un Latch T?" → No tiene sentido práctico porque al estar en nivel alto del clock, el latch toggle oscila indefinidamente (estado inestable)
- Implementación teórica: a partir de Latch SR
- Mostrar visualmente por qué oscila (animación)

### 3.2 Flip-Flops

#### Flip-Flop D (FF-D)
- **Edge-triggered** (sensible al flanco, ascendente o descendente configurable)
- Implementación interna: Master-Slave (dos latches D en cascada con clock invertido)
- Entradas: D, Clock, Preset (asíncrono), Clear (asíncrono)
- Salidas: Q, Q' (complemento)
- **Tiempos configurables:**
  - t_setup: tiempo mínimo que D debe ser estable antes del flanco
  - t_hold: tiempo mínimo que D debe mantenerse después del flanco
  - t_propagation: tiempo desde el flanco hasta que Q cambia

#### Flip-Flop JK (FF-JK)
- Tabla de estados: J=K=0 (mantiene), J=1 K=0 (set), J=0 K=1 (reset), J=K=1 (toggle)
- **Conversiones (preguntas de final):**
  - FF-JK a partir de FF-D → Ecuación: `D = J·Q' + K'·Q`
  - FF-D a partir de FF-JK → `J = D, K = D'`
  - FF-JK a partir de FF-T → Usar lógica combinacional
  - FF-T a partir de FF-JK → `J = K = T`
- Implementar visualmente cada conversión mostrando la lógica adicional

#### Flip-Flop T (Toggle)
- J = K = T
- Si T=1: cambia estado; si T=0: mantiene estado
- **Divisor de frecuencia:** Cada FF-T divide la frecuencia por 2
- **Pregunta de final:** "Determine el número de FFs necesarios para dividir frecuencia m a n MHz, siendo m/n = 2^i" → i flip-flops
- Implementar visualmente el divisor de frecuencia con onda cuadrada animada

### 3.3 Registros

#### Registro PIPO (Parallel-In, Parallel-Out)
- Entrada paralela de N bits, salida paralela de N bits
- Carga paralela con señal Load
- Clear/Reset asíncrono
- Configurable: 4, 8, 16 bits

#### Registro SIPO (Serial-In, Parallel-Out)
- Entrada serial, salida paralela
- Shift register de N bits

#### Registro PISO (Parallel-In, Serial-Out)
- Entrada paralela, salida serial

#### Registro SISO (Serial-In, Serial-Out)
- Cadena de FFs en serie

#### Registro Universal
- Combina todas las funcionalidades: carga paralela, shift left, shift right, retención
- Control de operación por señal de modo (2 bits)

#### Registro de Desplazamiento
- Shift left de 4 bits basado en FF-T (ejercicio de final)
- Shift right
- Con/sin entrada serial
- Barrel shifter

#### Banco de Registros (Register File)
- **N registros de M bits** (ej: 8 registros de 8 bits)
- 2 puertos de lectura + 1 puerto de escritura
- Selección de registro por dirección
- Componente central del procesador de cátedra
- Implementado con MUX para lectura y DMUX para escritura

#### Ejercicio Fachero (ejercicio estrella de final)
Registro PIPO de 8 bits con funcionalidad múltiple controlada por `op` (2 bits):
- op=0: R = Data (carga directa)
- op=1: R = R + 1 (incremento)
- op=2: R = R + Data (suma)
- op=3: R = R >> 1 (shift right)

Implementar con MUX que seleccione entre las 4 operaciones, alimentando el resultado al registro.
Este ejercicio también tiene un inciso de **cálculo de tiempos** (ver Módulo 4).

### 3.4 Contadores

#### Contador Síncrono Ascendente
- Basado en **FF-D** (ejercicio de final: "implementar con esquemático")
- Basado en **FF-T** (cada FF-T recibe el AND de todos los bits anteriores)
- Basado en **FF-JK**
- **4 bits y 8 bits**
- Con/sin enable
- Con/sin señal de carga paralela
- Con señal de terminal count (TC) para encadenamiento

#### Contador Síncrono Descendente
- Basado en **FF-T** de 4 bits (ejercicio de final)
- De 8 bits con carga desde entrada I: cuando llega a 0, recarga con I (ejercicio de final)

#### Contador Asíncrono (Ripple Counter)
- El clock de cada FF es la salida del FF anterior (no el clock global)
- Más lento pero más simple

#### Preguntas teóricas sobre contadores (todas de final):
- "¿Un contador de programa (PC) es síncrono o asíncrono?" → Síncrono (necesita respuesta rápida y predecible)
- "¿Debe implementarse con latches o FFs?" → FFs (edge-triggered para evitar problemas de transparencia)
- Diferencias, ventajas y desventajas entre síncronos y asíncronos
- Expresión genérica de frecuencia de funcionamiento
- Función lógica del bit de menor peso

#### Divisor de Frecuencia
- Ejercicio de final: "Reloj de 10ns de período, implementar circuito para registrar dato de 4 bits a 12.5MHz usando solo FF-JK y compuertas ANDORI"
- Período de 10ns = 100MHz; 100/12.5 = 8 = 2³ → 3 FF-T (implementados con FF-JK: J=K=1)
- Visualizar la onda dividida paso a paso

### 3.5 Intercambio de Registros
Ejercicio de final: con FF-JK, carga paralela de 4 bits en RegX y RegY cuando Load=1, o intercambio de contenido entre registros cuando Load=0. Implementar con MUX controlados por Load.

---

## ⏱️ MÓDULO 4: ANÁLISIS TEMPORAL

### 4.1 Conceptos de Tiempo
Implementar un **panel de análisis temporal** que permita:

#### Tiempos de Compuertas
- Cada compuerta tiene un retardo configurable:
  - t_AND (default: 2ns)
  - t_OR (default: 3ns)
  - t_XOR (default: 4ns)
  - t_NOT (default: 1ns)
  - t_NAND (default: 2ns)
  - t_NOR (default: 2ns)

#### Tiempos de Elementos de Memoria
- **t_setup:** Tiempo mínimo que la entrada D debe ser estable ANTES del flanco activo del clock
- **t_hold:** Tiempo mínimo que la entrada D debe mantenerse estable DESPUÉS del flanco activo
- **t_propagation (t_clk-q):** Tiempo desde el flanco del clock hasta que la salida Q se estabiliza
- Valores por defecto: t_setup = 0.25ns, t_hold = 0.5ns, t_prop = 0.75ns

#### Cálculo Automático del Camino Crítico
- **Período mínimo de reloj:** T_min = t_prop + t_critical_path + t_setup
  - t_critical_path es el camino combinacional más largo entre dos registros
- **Frecuencia máxima:** f_max = 1 / T_min
- El sistema debe:
  1. Identificar automáticamente todos los caminos entre registros
  2. Calcular el retardo de cada camino
  3. Resaltar el **camino crítico** en el canvas (highlight rojo)
  4. Mostrar el período mínimo y frecuencia máxima

### 4.2 Visualización Temporal
- **Diagrama de tiempos (Waveform Viewer):** Similar a GTKWave
  - Seleccionar señales para observar
  - Mostrar forma de onda de cada señal en el tiempo
  - Zoom horizontal (tiempo) y agrupamiento de señales
  - Marcar flancos de clock
  - Mostrar t_setup, t_hold, t_prop como zonas sombreadas en el diagrama
- **Modo Step-by-step:** Avanzar la simulación un paso de propagación a la vez, viendo cómo las señales cambian componente por componente

### 4.3 Ejercicios Temporales del Curso
La app debe poder resolver y visualizar automáticamente:

1. **Tiempo de estabilización de sumador de 64 bits:**
   - Con t_and=1.5ns, t_or=2ns, t_xor=3ns
   - Camino crítico: carry chain a través de 64 Full Adders

2. **Ejercicio Fachero — período mínimo:**
   - Con t_and=2ns, t_or=3ns, t_xor=4ns, t_set=0.25ns, t_hold=0.5ns, t_prop=0.75ns
   - Determinar el camino crítico entre el registro PIPO y sí mismo a través de cada operación

3. **Circuito con bloques A, B, C:**
   - Bloques combinacionales con tiempos: A=10ns, B=8ns, C=12ns
   - t_setup=0.5ns, t_hold=0.25ns, t_prop=1.5ns
   - Determinar T_min y verificar si funciona a 50MHz, 75MHz, 100MHz

4. **Diferencia entre carry chain y función mayoría:**
   - Sumador de 3 bits: comparar tiempos de propagación del carry

5. **DMUX8_4 — tiempo de cálculo y costo en área:**
   - A partir de DMUX2_1
   - t_and=3ns, t_or=4ns, t_xor=5ns

6. **Sumador de 4 bits — latencia máxima de 15ns:**
   - Con t_and=2ns, t_or=3ns, t_xor=4ns
   - Determinar la cantidad máxima de bits que el sumador puede procesar

---

## 🖥️ MÓDULO 5: PROCESADOR DE CÁTEDRA

### 5.1 Arquitectura del Procesador
Implementar un **procesador completo de 8 bits** como el de cátedra:

#### Componentes del Procesador:
```
┌─────────────────────────────────────────────────────┐
│                    PROCESADOR                        │
│                                                      │
│  ┌─────┐     ┌──────┐    ┌─────────┐               │
│  │ PC  │────▶│ RAM  │───▶│   IR    │               │
│  │(+1) │     │      │    │ (Reg.   │               │
│  └──┴──┘     └──────┘    │  Instr.)│               │
│     │                     └────┬────┘               │
│     │                          │                     │
│     │    ┌─────────────────────┘                     │
│     │    │                                           │
│     │    ▼                                           │
│     │  ┌──────────┐                                  │
│     │  │ Unidad   │──── señales de control ─────▶   │
│     │  │ de       │                                  │
│     │  │ Control  │                                  │
│     │  │  (CU)    │                                  │
│     │  └──────────┘                                  │
│     │                                                │
│     │        ┌──────────────────┐                    │
│     │        │  Banco de       │                     │
│     │        │  Registros      │                     │
│     │        │  (8 × 8 bits)   │                     │
│     │        └───────┬─────────┘                    │
│     │                │                               │
│     │                ▼                               │
│     │        ┌──────────────────┐                    │
│     │        │      ALU        │                     │
│     │        │   (8 bits)      │                     │
│     │        │  +,-,AND,OR,    │                     │
│     │        │  XOR,NOT,SHL,   │                     │
│     │        │  SHR            │                     │
│     │        └───────┬─────────┘                    │
│     │                │                               │
│     │                ▼                               │
│     │        ┌──────────────────┐                    │
│     │        │  Registro       │                     │
│     │        │  Acumulador     │                     │
│     │        │  (Acc - 8 bits) │                     │
│     │        └─────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

#### Componentes detallados:

1. **Program Counter (PC):**
   - Registro de 8 bits + incrementador (+1)
   - Salida conectada a la dirección de la RAM
   - Carga paralela para instrucciones de salto
   - **Es un componente síncrono (FF), NO puede ser latch** (pregunta de final)

2. **RAM (Memoria de instrucciones y datos):**
   - Memoria de lectura/escritura
   - Dirección: 8 bits (256 posiciones)
   - Dato: 8 bits
   - Señales: Address, DataIn, DataOut, WriteEnable, ReadEnable
   - t_ram configurable (default: 4ns)
   - Editor visual del contenido (como una tabla hex)
   - Cargar programas en ensamblador directamente

3. **Registro de Instrucción (IR):**
   - Almacena la instrucción actual leída de la RAM
   - Descompone la instrucción en: opcode + operandos
   - Formato de instrucción: [opcode (3 bits)][registro (3 bits)][inmediato (2 bits)] (ejemplo)
   - **Pregunta de final:** "¿Qué pasa si el procesador NO tiene IR?" → El dato de la RAM va directamente a la CU, impacta en el período de reloj

4. **Unidad de Control (CU):**
   - Recibe el opcode del IR
   - Genera señales de control para todos los componentes:
     - reg_write: habilita escritura en banco de registros
     - alu_op: selecciona operación de la ALU
     - mem_read / mem_write
     - mux_sel: selectores de multiplexores del datapath
     - pc_load: carga en PC para saltos
     - jz: señal para instrucción JZ (jump if zero)
   - Implementada como circuito combinacional (decodificador)
   - **Pregunta de final:** "¿Cuántas funciones booleanas tiene la CU?" → Una por cada señal de control
   - t_cu configurable (default: 3ns)

5. **Banco de Registros:**
   - 8 registros de 8 bits (R0-R7)
   - 2 puertos de lectura + 1 puerto de escritura
   - Selección por campo del IR
   - **Pregunta de final:** "¿Se pueden implementar con latches?" → Depende del datapath

6. **Registro Acumulador (Acc):**
   - 8 bits, almacena resultado de la ALU
   - Operaciones: Acc = Ri op Acc
   - **Debe ser FF, NO latch** (realimentación directa con la ALU)

7. **Multiplexores del Datapath:**
   - MUX para seleccionar fuente de datos para la ALU (registro vs inmediato)
   - MUX para seleccionar fuente del PC (PC+1 vs inmediato para saltos)
   - MUX 2:1 de 8 bits (t_mux configurable, default: 2ns)

8. **Demultiplexores del Datapath:**
   - DMUX para dirigir datos de escritura al registro correcto
   - DMUX 2:1 (t_dmux configurable, default: 2ns)

9. **Buffers tri-estado:**
   - Para control de bus compartido
   - t_buffers configurable (default: 1ns)

### 5.2 Instrucciones del Procesador
Implementar un mini-assembler que soporte instrucciones tipo:

| Instrucción | Descripción | Formato |
|-------------|-------------|----------|
| `LOAD Ri` | Acc = Ri | opcode + reg |
| `STORE Ri` | Ri = Acc | opcode + reg |
| `ADD Ri` | Acc = Ri + Acc | opcode + reg |
| `SUB Ri` | Acc = Ri - Acc | opcode + reg |
| `AND Ri` | Acc = Ri AND Acc | opcode + reg |
| `OR Ri` | Acc = Ri OR Acc | opcode + reg |
| `XOR Ri` | Acc = Ri XOR Acc | opcode + reg |
| `NOT` | Acc = NOT Acc | opcode |
| `SHL` | Acc = Acc << 1 | opcode |
| `SHR` | Acc = Acc >> 1 | opcode |
| `LOADI imm` | Acc = inmediato | opcode + imm |
| `JZ imm` | Si Z=1, PC = imm | opcode + imm |
| `JMP imm` | PC = imm | opcode + imm |

### 5.3 Extensión JZ (Jump if Zero) — Ejercicio de Final
Modificar el procesador para admitir la instrucción **JZ immediate:**
- Carga en PC el valor del inmediato si el resultado de la ALU para la instrucción anterior fue cero
- Agregar:
  - Salida `zero` de 1 bit en la ALU
  - Un FF que almacene el flag zero del ciclo anterior
  - Señal `jz` de la CU
  - MUX adicional en la entrada del PC: selecciona entre PC+1 e inmediato
  - Lógica: `pc_load = jz AND zero_flag`
- Análisis de impacto en frecuencia máxima
- Costo en área: compuertas de 2 entradas + FFs adicionales

### 5.4 Tiempos del Procesador
Con los tiempos de referencia del curso:
- t_ram = 4ns
- t_mux2_8 = 2ns
- t_dmux2_1 = 2ns
- t_cu = 3ns
- t_add_8bits = 5ns
- t_sub_8bits = 5ns
- t_compuertas_8bits = 1ns
- t_shift = 0.5ns
- t_buffers = 1ns
- t_setup = 0.25ns
- t_prop = 0.75ns
- t_hold = 0.01ns

**Calcular automáticamente:**
- Período mínimo de reloj del procesador
- Frecuencia máxima de operación
- Latencia por instrucción
- Tiempo total de ejecución de un programa de N instrucciones

### 5.5 Preguntas Teóricas sobre el Procesador (todas de final)
La app debe poder responder/mostrar:

1. **Componentes combinacionales del procesador:** ALU, CU, MUX, DMUX, decodificadores, incrementador del PC
2. **Componentes secuenciales:** PC, IR, Banco de Registros, Acumulador, RAM
3. **¿Cuáles se pueden implementar con latches?**
   - El banco de registros puede usar latches si no hay realimentación directa
   - El acumulador NO puede (se realimenta con la ALU)
   - El PC NO puede (necesita ser edge-triggered)
   - El IR puede usar latches si se garantiza que el dato de la RAM es estable
4. **¿Se puede implementar el procesador en un FPGA solo con Slices?** → Sí, pero depende de la cantidad de Slices disponibles vs recursos necesarios
5. **¿Cuántas funciones booleanas tiene la CU?** → Una por cada señal de control
6. **¿Cuántas funciones booleanas tiene el PC?** → Una por cada bit (8 funciones) + lógica de control

---

## ⚡ FUNCIONALIDADES AVANZADAS DE LA APP

### Editor de Circuitos
- **Drag & drop** de componentes desde la paleta
- **Snap to grid** configurable
- **Cables auto-routing:** Los cables deben encontrar rutas evitando solapamiento con componentes
- **Selección múltiple** para mover, copiar, borrar grupos de componentes
- **Copy/Paste** de subcircuitos
- **Undo/Redo** ilimitado (Ctrl+Z / Ctrl+Shift+Z)
- **Zoom:** scroll + Ctrl+scroll + doble tap para fit all
- **Pan:** click medio + drag o Space + drag
- **Mini-mapa** en una esquina para navegación rápida en circuitos grandes

### Subcircuitos y Jerarquía
- Crear **subcircuitos** reutilizables (como en Logisim)
- Doble clic en un subcircuito para "entrar" y ver su implementación interna
- Breadcrumb navigation para navegar la jerarquía
- Los subcircuitos aparecen como bloques en la paleta con pines de entrada/salida configurables
- **Plantillas predefinidas** para circuitos comunes:
  - Half Adder, Full Adder
  - Sumador de N bits
  - Latch SR, D, T
  - FF-D, FF-JK, FF-T
  - Registro de N bits
  - Contador de N bits
  - ALU de 8 bits
  - Procesador completo

### Simulación
- **Modo de edición** vs **Modo de simulación** (toggle claro)
- En modo simulación:
  - Hacer clic en pins de entrada toggles su valor
  - Los valores se propagan instantáneamente (modo ideal) o con retardos (modo temporal)
  - El clock puede ser manual (clic) o automático (frecuencia configurable)
  - **Step mode:** Avanzar un flanco de clock a la vez
  - Breakpoints: pausar cuando una señal alcanza un valor específico

### Tabla de Verdad Automática
- Seleccionar un subcircuito o grupo de componentes
- La app genera automáticamente su tabla de verdad completa
- Exportable como CSV o imagen

### Exportar/Importar
- **Guardar** proyectos como archivo JSON
- **Exportar** como imagen (PNG/SVG)
- **Exportar** como archivo .circ de Logisim (compatibilidad)
- **Importar** archivos .circ de Logisim
- **Compartir** link de circuito (si hay backend)

### Tutoriales Interactivos
- Guía paso a paso para cada módulo del curso
- "Tour guiado" al abrir la app por primera vez
- Ejemplos precargados para cada tipo de circuito
- Desafíos: "Implementa un MUX 2:1 usando solo compuertas NAND" con verificación automática

---

## 🛠️ STACK TÉCNICO RECOMENDADO

### Frontend
- **Framework:** React 19+ con TypeScript
- **Canvas/Render:** 
  - Opción A: **React Flow** (para grafos/nodos — excelente para circuitos)
  - Opción B: **Konva.js** o **PixiJS** (para rendering de alto rendimiento si React Flow no alcanza)
  - Opción C: **HTML Canvas** custom con WebGL para animaciones de señales
- **State Management:** Zustand (liviano, ideal para estado de circuito)
- **Estilos:** Tailwind CSS 4.x + Shadcn/UI para componentes de UI
- **Animaciones:** Framer Motion para UI + requestAnimationFrame custom para animaciones de señales en el canvas
- **Waveform Viewer:** D3.js o custom canvas
- **Drag & Drop:** dnd-kit (accessible, performant)
- **Icons:** Lucide React
- **Routing:** React Router o TanStack Router (si hay múltiples páginas)

### Simulación Engine
- **Motor de simulación** en Web Worker para no bloquear la UI
- Event-driven simulation: propagar cambios solo cuando hay cambios en las entradas
- Soporte para detección de loops infinitos y estados metaestables
- Cálculo de camino crítico: algoritmo de camino más largo en DAG

### Backend (opcional, para persistencia y sharing)
- **Runtime:** Bun o Node.js
- **DB:** SQLite (via Turso) o Supabase
- **Auth:** Supabase Auth o Clerk
- **Hosting:** Vercel o Cloudflare Pages

### Build & Dev
- **Bundler:** Vite
- **Testing:** Vitest + Playwright
- **Linting:** ESLint + Prettier + Biome

---

## 📐 ARQUITECTURA DE DATOS

### Modelo de Circuito (JSON Schema conceptual)
```typescript
interface Circuit {
  id: string;
  name: string;
  author: string; // "Santiago Santillán"
  components: Component[];
  wires: Wire[];
  subcircuits: Circuit[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    module: 1 | 2 | 3 | 4 | 5; // Módulo del curso
    tags: string[];
  };
}

interface Component {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
  properties: Record<string, any>;
  inputPins: Pin[];
  outputPins: Pin[];
}

interface Wire {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
  waypoints: { x: number; y: number }[];
  bitWidth: number;
  currentValue: number;
}

interface Pin {
  id: string;
  name: string;
  direction: 'input' | 'output';
  bitWidth: number;
  negated: boolean;
}

type ComponentType =
  // Gates
  | 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'BUFFER' | 'TRI_STATE_BUFFER'
  // Wiring
  | 'INPUT_PIN' | 'OUTPUT_PIN' | 'CLOCK' | 'CONSTANT' | 'SPLITTER' | 'TUNNEL' | 'PROBE'
  | 'POWER' | 'GROUND'
  // Plexers
  | 'MUX' | 'DMUX' | 'DECODER' | 'ENCODER' | 'PRIORITY_ENCODER'
  // Arithmetic
  | 'HALF_ADDER' | 'FULL_ADDER' | 'ADDER_N' | 'SUBTRACTOR' | 'ADDER_SUBTRACTOR'
  | 'COMPARATOR' | 'ALU'
  // Memory (Latches)
  | 'LATCH_SR' | 'LATCH_SR_SYNC' | 'LATCH_D' | 'LATCH_T'
  // Memory (Flip-Flops)
  | 'FF_D' | 'FF_JK' | 'FF_T'
  // Registers
  | 'REG_PIPO' | 'REG_SIPO' | 'REG_PISO' | 'REG_SISO' | 'REG_UNIVERSAL'
  | 'SHIFT_REGISTER' | 'REGISTER_FILE'
  // Counters
  | 'COUNTER_SYNC_UP' | 'COUNTER_SYNC_DOWN' | 'COUNTER_ASYNC' | 'FREQ_DIVIDER'
  // Synthesis
  | 'PLA' | 'ROM' | 'LUT' | 'FPGA_SLICE'
  // Processor
  | 'PC' | 'RAM' | 'IR' | 'CU' | 'ACC' | 'PROCESSOR';
```

---

## 🎯 CIRCUITOS DE EJEMPLO PRECARGADOS (desde los enunciados de final)

La app debe venir con los siguientes circuitos precargados como ejemplos/tutoriales:

### Básicos (Módulo 1)
1. NOT, AND, OR implementados con NAND
2. NOT, AND, OR implementados con NOR
3. MUX 2:1 con compuertas AND-OR
4. MUX 2:1 con solo NAND
5. MUX 2:1 con solo NOR
6. DMUX 2:1
7. Full Adder con función mayoría
8. Full Adder con solo NAND
9. Sumador Ripple Carry de 4 bits

### Síntesis (Módulo 2)
10. Función F minimizada en Karnaugh e implementada en ANDORI
11. Función implementada en PLA
12. Función implementada en ROM + MUX
13. Sumador de 4 bits en Slices de FPGA (5 LUTs)
14. MUX 8:1 en Slices FPGA

### Secuenciales (Módulo 3)
15. Latch SR con NOR
16. Latch SR con NAND
17. FF-D Master-Slave
18. FF-JK a partir de FF-D
19. FF-T a partir de FF-JK
20. Registro PIPO de 8 bits
21. Contador síncrono ascendente de 4 bits (FF-T)
22. Contador síncrono descendente de 4 bits (FF-T)
23. Contador síncrono descendente de 8 bits con recarga
24. Divisor de frecuencia de 100MHz a 12.5MHz
25. "Ejercicio Fachero" — Registro con 4 operaciones

### Procesador (Módulo 5)
26. Procesador completo de 8 bits (el de cátedra)
27. Procesador con extensión JZ
28. Procesador sin IR (variante de final)

---

## 📱 RESPONSIVE Y ACCESIBILIDAD
- La app debe funcionar en desktop (optimizada) y ser usable en tablets
- Atajos de teclado documentados (como en Figma)
- Tema claro/oscuro
- Nombres descriptivos y tooltips en todos los componentes
- Accesibilidad WCAG 2.1 AA para la UI (no necesariamente para el canvas)

---

## 🏁 PRIORIDADES DE IMPLEMENTACIÓN

### Fase 1 — MVP (Core)
1. Canvas con pan/zoom
2. Compuertas básicas (AND, OR, NOT, NAND, NOR, XOR)
3. Cables y conexiones
4. Pines de entrada/salida (toggle + LED)
5. Simulación básica (propagación instantánea)
6. MUX y DMUX
7. Guardar/cargar circuito (JSON local)

### Fase 2 — Secuenciales
8. Clock
9. Latches (SR, D)
10. Flip-Flops (D, JK, T)
11. Registros (PIPO, shift)
12. Contadores (síncrono/asíncrono)
13. Waveform viewer básico

### Fase 3 — Síntesis
14. Mapa de Karnaugh
15. PLA
16. ROM
17. FPGA Slices y LUTs
18. Generación automática de circuitos desde mintérminos

### Fase 4 — Procesador
19. ALU de 8 bits
20. Banco de registros
21. PC + incrementador
22. RAM + editor
23. Unidad de Control
24. Registro de Instrucción
25. Ensamblador integrado
26. Procesador completo armable

### Fase 5 — Polish
27. Subcircuitos jerárquicos
28. Análisis temporal completo
29. Animaciones avanzadas de flujo de señales
30. Tutoriales interactivos
31. Exportar/importar Logisim
32. Circuitos de ejemplo precargados

---

> **Nota final:** Este prompt fue generado a partir del análisis exhaustivo de todo el material del curso de Diseño Lógico de la UTN, incluyendo 5 módulos de filminas teóricas, 5 trabajos prácticos, 12+ finales con sus enunciados detallados, y archivos de circuito de Logisim. Cada componente, ejercicio y pregunta teórica mencionada aquí corresponde a contenido real del curso.
>
> **Santiago Santillán — DisLogic © 2026**
