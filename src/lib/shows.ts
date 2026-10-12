import { sql } from "./db";

export type Show = {
  id: number;
  show_date: string;
  venue: string;
  status: "draft" | "live" | "closed";
  requests_per_person: number;
  window_minutes: number;
  max_requests: number | null;
  requests_open: boolean;
  published_at: string | null;
  closed_at: string | null;
};

export async function getLiveShow(): Promise<Show | null> {
  const [show] = await sql<Show[]>`select * from shows where status = 'live' limit 1`;
  return show ?? null;
}

export async function getShow(id: number): Promise<Show | null> {
  const [show] = await sql<Show[]>`select * from shows where id = ${id}`;
  return show ?? null;
}

export type QueueItem = {
  song_id: number;
  title: string;
  artist_credit: string;
  status: "pending" | "accepted";
  votes: number;
  first_at: string;
};

/**
 * Fila do show: uma linha por música com pedidos ainda em aberto (pendente/aceito),
 * na ordem do primeiro pedido. É a mesma ordem usada para mostrar a posição à plateia.
 */
export async function getQueue(showId: number): Promise<QueueItem[]> {
  return sql<QueueItem[]>`
    select r.song_id, s.title, s.artist_credit,
           case when bool_or(r.status = 'accepted') then 'accepted' else 'pending' end as status,
           count(*)::int as votes,
           min(r.created_at) as first_at
    from song_requests r join songs s on s.id = r.song_id
    where r.show_id = ${showId} and r.status in ('pending', 'accepted')
    group by r.song_id, s.title, s.artist_credit
    order by min(r.created_at)`;
}

export type DoneItem = {
  song_id: number;
  title: string;
  artist_credit: string;
  status: "played" | "rejected";
  votes: number;
  updated_at: string;
};

export async function getDone(showId: number): Promise<DoneItem[]> {
  return sql<DoneItem[]>`
    select r.song_id, s.title, s.artist_credit, max(r.status) as status,
           count(*)::int as votes, max(r.updated_at) as updated_at
    from song_requests r join songs s on s.id = r.song_id
    where r.show_id = ${showId} and r.status in ('played', 'rejected')
    group by r.song_id, s.title, s.artist_credit
    order by max(r.updated_at) desc`;
}

export async function countRequests(showId: number) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from song_requests where show_id = ${showId} and status <> 'rejected'`;
  return n;
}

/** Quando a pessoa poderá pedir de novo (null = pode pedir agora). */
export async function nextAllowedAt(show: Show, deviceId: string): Promise<Date | null> {
  const rows = await sql<{ created_at: Date }[]>`
    select created_at from song_requests
    where show_id = ${show.id} and device_id = ${deviceId}
      and created_at > now() - make_interval(mins => ${show.window_minutes})
    order by created_at`;
  if (rows.length < show.requests_per_person) return null;
  const oldest = rows[rows.length - show.requests_per_person].created_at;
  return new Date(new Date(oldest).getTime() + show.window_minutes * 60_000);
}

/** Registra o acesso do aparelho no dia (um registro por aparelho/dia, ligado ao show ao vivo). */
export async function recordVisit(deviceId: string, showId: number | null) {
  await sql`
    insert into visits (device_id, visit_date, show_id)
    values (${deviceId}, (now() at time zone 'America/Sao_Paulo')::date, ${showId})
    on conflict (device_id, visit_date) do update
      set hits = visits.hits + 1, last_seen = now(),
          show_id = coalesce(excluded.show_id, visits.show_id)`;
}
