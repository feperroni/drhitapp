import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { emit } from "@/lib/events";
import { getLiveShow } from "@/lib/shows";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  const artist = String(body.artist ?? "").trim().slice(0, 120);
  if (title.length < 2) return NextResponse.json({ error: "Informe o nome da música." }, { status: 400 });

  const deviceId = await getDeviceId();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from suggestions where device_id = ${deviceId} and created_at > now() - interval '1 hour'`;
  if (n >= 5) return NextResponse.json({ error: "Muitas sugestões seguidas. Tente mais tarde." }, { status: 429 });

  const show = await getLiveShow();
  await sql`
    insert into suggestions (show_id, device_id, title, artist)
    values (${show?.id ?? null}, ${deviceId}, ${title}, ${artist || null})`;
  emit({ type: "suggestion" });
  return NextResponse.json({ ok: true });
}
