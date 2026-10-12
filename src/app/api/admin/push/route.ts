import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { notifyBand } from "@/lib/push";

export async function POST(req: Request) {
  const { subscription, label, test } = await req.json().catch(() => ({}));
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }
  await sql`
    insert into push_subscriptions (endpoint, p256dh, auth, label)
    values (${endpoint}, ${keys.p256dh}, ${keys.auth}, ${label ?? null})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
  if (test) {
    await notifyBand({ title: "🎸 Dr. Hit", body: "Notificações ativadas neste aparelho!", url: "/admin/ao-vivo" });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
  return NextResponse.json({ ok: true });
}
