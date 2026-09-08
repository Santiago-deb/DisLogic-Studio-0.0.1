// DisLogic — API de circuitos compartidos
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, data, author } = body as { name?: string; data?: string; author?: string };
    if (!data || typeof data !== "string" || data.length > 2_000_000) {
      return NextResponse.json({ error: "Circuito inválido o demasiado grande" }, { status: 400 });
    }
    const saved = await db.sharedCircuit.create({
      data: {
        name: (name ?? "Sin título").slice(0, 120),
        data,
        author: (author ?? "Santiago Santillán").slice(0, 80),
      },
    });
    return NextResponse.json({ id: saved.id, name: saved.name });
  } catch (e) {
    console.error("POST /api/circuits", e);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const list = await db.sharedCircuit.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, name: true, createdAt: true, author: true },
    });
    return NextResponse.json(list);
  } catch (e) {
    console.error("GET /api/circuits", e);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}
