import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { emit } from "@/lib/events";

const TRANSITIONS = {
  accept: { to: "accepted", from: ["pending"] },
  played: { to: "played", from: ["pending", "accepted"] },
  reject: { to: "rejected", from: ["pending", "accepted"] },
  reopen: { to: "pending", from: ["played", "rejected", "accepted"] },
} as const;

/** Ação da banda sobre todos os pedidos de uma música no show. */
export async function POST(req: Request) {
  const { showId, songId, action } = await req.json().catch(() => ({}));
  const t = TRANSITIONS[action as keyof typeof TRANSITIONS];
  if (!t || !Number.isInteger(showId) || !Number.isInteger(songId)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  await sql`
    update song_requests set status = ${t.to}, updated_at = now()
    where show_id = ${showId} and song_id = ${songId} and status in ${sql([...t.from])}`;
  emit({ type: "queue", showId });
  return NextResponse.json({ ok: true });
}
