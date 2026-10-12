import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { emit } from "@/lib/events";

/** Ajustes rápidos do show pelo painel ao vivo: abrir/fechar pedidos e limites. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const id = Number(b.showId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Show inválido" }, { status: 400 });

  if (typeof b.requestsOpen === "boolean") {
    await sql`update shows set requests_open = ${b.requestsOpen} where id = ${id}`;
  }
  if (b.requestsPerPerson != null) {
    await sql`update shows set requests_per_person = ${Math.max(1, Math.floor(Number(b.requestsPerPerson)) || 1)} where id = ${id}`;
  }
  if (b.windowMinutes != null) {
    await sql`update shows set window_minutes = ${Math.max(1, Math.floor(Number(b.windowMinutes)) || 60)} where id = ${id}`;
  }
  if ("maxRequests" in b) {
    const max = b.maxRequests === null || b.maxRequests === "" ? null : Math.max(1, Math.floor(Number(b.maxRequests)) || 1);
    await sql`update shows set max_requests = ${max} where id = ${id}`;
  }
  emit({ type: "queue", showId: id });
  return NextResponse.json({ ok: true });
}
