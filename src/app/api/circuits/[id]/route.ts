// DisLogic — Obtener un circuito compartido por id
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const circuit = await db.sharedCircuit.findUnique({
      where: { id },
      select: { id: true, name: true, data: true },
    });
    if (!circuit) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(circuit);
  } catch (e) {
    console.error("GET /api/circuits/[id]", e);
    return NextResponse.json({ error: "Error al obtener" }, { status: 500 });
  }
}
