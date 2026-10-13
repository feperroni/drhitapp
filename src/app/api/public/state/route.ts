import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { countRequests, getLiveShow, getQueue, nextAllowedAt, recordVisit } from "@/lib/shows";

export const dynamic = "force-dynamic";

/** Estado da plateia: show ao vivo, meus pedidos (com posição na fila) e se posso pedir agora. */
export async function GET(req: Request) {
  const deviceId = await getDeviceId();
  const show = await getLiveShow();
  const isVisit = new URL(req.url).searchParams.has("visit");

  if (isVisit) await recordVisit(deviceId, show?.id ?? null);

  if (!show) return NextResponse.json({ show: null });

  const [queue, mine, closed, total, next, promos, merch] = await Promise.all([
    getQueue(show.id),
    sql<{ song_id: number; title: string; artist_credit: string; status: string; created_at: string }[]>`
      select r.song_id, s.title, s.artist_credit, r.status, r.created_at
      from song_requests r join songs s on s.id = r.song_id
      where r.show_id = ${show.id} and r.device_id = ${deviceId}
      order by r.created_at desc`,
    sql<{ song_id: number; status: string }[]>`
      select distinct song_id, status from song_requests
      where show_id = ${show.id} and status in ('played', 'rejected')`,
    countRequests(show.id),
    nextAllowedAt(show, deviceId),
    sql<{ id: number; title: string; description: string | null }[]>`
      select id, title, description from promotions
      where show_id = ${show.id} and active order by created_at`,
    sql<{ id: number; name: string; description: string | null; price_cents: number; sold_out: boolean; image: string | null }[]>`
      select id, name, description, price_cents, sold_out,
             case when image is not null
               then '/api/merch/' || id || '/image?v=' || extract(epoch from updated_at)::bigint end as image
      from merch_items where show_id = ${show.id}
      order by sold_out, id`,
  ]);

  const position = new Map(queue.map((q, i) => [q.song_id, i + 1]));
  const full = show.max_requests != null && total >= show.max_requests;

  return NextResponse.json({
    show: {
      id: show.id,
      venue: show.venue,
      date: show.show_date,
      startTime: show.start_time,
      endTime: show.end_time,
      open: show.requests_open && !full,
      full,
      requestsPerPerson: show.requests_per_person,
      windowMinutes: show.window_minutes,
    },
    mine: mine.map((m) => ({
      songId: m.song_id,
      title: m.title,
      credit: m.artist_credit,
      status: m.status,
      createdAt: m.created_at,
      position: m.status === "pending" || m.status === "accepted" ? position.get(m.song_id) ?? null : null,
    })),
    queueSize: queue.length,
    unavailable: closed.map((c) => ({ songId: c.song_id, status: c.status })),
    nextAllowedAt: next?.toISOString() ?? null,
    promotions: promos,
    merch: merch.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price: m.price_cents,
      soldOut: m.sold_out,
      image: m.image,
    })),
  });
}
