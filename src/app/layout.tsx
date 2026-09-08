import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DisLogic — Simulador de Circuitos Digitales",
  description:
    "Diseñá, simulá y analizá circuitos digitales: compuertas, Karnaugh, secuenciales, análisis temporal y un procesador de 8 bits. Diseñado por Santiago Santillán — Diseño Lógico UTN.",
  keywords: ["circuitos digitales", "simulador", "Karnaugh", "flip-flop", "ALU", "procesador", "UTN", "DisLogic"],
  authors: [{ name: "Santiago Santillán" }],
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='8' y='8' width='16' height='16' rx='2' fill='%230B2233' stroke='%2300AAFF' stroke-width='2'/%3E%3Ctext x='16' y='20' font-size='9' font-family='monospace' fill='%2300AAFF' text-anchor='middle' font-weight='bold'%3EDL%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
