import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { emit } from "@/lib/events";
import { getLiveShow } from "@/lib/shows";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 60);
  const message = String(body.message ?? "").trim().slice(0, 1000);
  if (message.length < 2) return NextResponse.json({ error: "Escreva sua mensagem." }, { status: 400 });

  const deviceId = await getDeviceId();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from comments where device_id = ${deviceId} and created_at > now() - interval '1 hour'`;
  if (n >= 5) return NextResponse.json({ error: "Muitas mensagens seguidas. Tente mais tarde." }, { status: 429 });

  const show = await getLiveShow();
  await sql`
    insert into comments (show_id, device_id, name, message)
    values (${show?.id ?? null}, ${deviceId}, ${name || null}, ${message})`;
  emit({ type: "comment" });
  return NextResponse.json({ ok: true });
}
