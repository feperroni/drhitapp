import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { emit } from "@/lib/events";
import { notifyBand } from "@/lib/push";
import { countRequests, getLiveShow, nextAllowedAt, recordVisit } from "@/lib/shows";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const { songId } = await req.json().catch(() => ({}));
  if (!Number.isInteger(songId)) return fail("Música inválida");

  const deviceId = await getDeviceId();
  const show = await getLiveShow();
  if (!show) return fail("Não há show acontecendo agora.");
  if (!show.requests_open) return fail("Os pedidos estão fechados no momento.");
  if (show.max_requests != null && (await countRequests(show.id)) >= show.max_requests) {
    return fail("O limite de pedidos deste show foi atingido. Obrigado!");
  }

  const next = await nextAllowedAt(show, deviceId);
  if (next) {
    const hhmm = next.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return fail(`Você já fez seu pedido. Poderá pedir de novo às ${hhmm}.`, 429);
  }

  const [song] = await sql<{ id: number; title: string; artist_credit: string }[]>`
    select id, title, artist_credit from songs where id = ${songId} and active`;
  if (!song) return fail("Música não encontrada no repertório.");

  const [done] = await sql<{ status: string }[]>`
    select status from song_requests
    where show_id = ${show.id} and song_id = ${songId} and status in ('played', 'rejected') limit 1`;
  if (done) {
    return fail(done.status === "played" ? "Essa música já foi tocada hoje! Escolha outra." : "Essa música não está disponível neste show.");
  }

  // Se a música já está na fila (aceita), o novo pedido entra como aceito também.
  const [queued] = await sql<{ status: string }[]>`
    select status from song_requests
    where show_id = ${show.id} and song_id = ${songId} and status = 'accepted' limit 1`;

  await sql`
    insert into song_requests (show_id, song_id, device_id, status)
    values (${show.id}, ${songId}, ${deviceId}, ${queued ? "accepted" : "pending"})`;

  await recordVisit(deviceId, show.id);
  emit({ type: "request", showId: show.id, songId, title: song.title, credit: song.artist_credit });
  notifyBand({
    title: `🎵 ${song.title}`,
    body: `${song.artist_credit} — novo pedido`,
    url: "/admin/ao-vivo",
    tag: `req-${show.id}-${songId}`,
  }).catch((e) => console.error(e));

  return NextResponse.json({ ok: true });
}
