import type { Metadata, Viewport } from "next";
import { B612, B612_Mono } from "next/font/google";
import "./globals.css";

const b612 = B612({ variable: "--font-b612", subsets: ["latin"], weight: ["400", "700"] });
const b612Mono = B612_Mono({ variable: "--font-b612-mono", subsets: ["latin"], weight: ["400", "700"] });

const ICONO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230d3a2b'/%3E%3Cpath d='M9 7h7a9 9 0 0 1 0 18H9z' fill='none' stroke='%23ffc247' stroke-width='2.4'/%3E%3Cpath d='M3 12h6M3 20h6M25 16h5' stroke='%23f0f4e6' stroke-width='2.4'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "DisLogic, simulador de circuitos digitales",
  description:
    "Dibujá y simulá circuitos digitales en el navegador: compuertas, mapas de Karnaugh, flip-flops, análisis de tiempos y un procesador de 8 bits.",
  authors: [{ name: "Santiago Santillan" }],
  icons: { icon: ICONO },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Se aplica antes de pintar, para que no parpadee el tema.
const TEMA_INICIAL = `try{var t=localStorage.getItem("dislogic:tema");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body suppressHydrationWarning className={`${b612.variable} ${b612Mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
