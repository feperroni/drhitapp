import { sql } from "./db";

export type Ranked = { label: string; sub?: string; value: number };

export async function showInsights(showId: number) {
  const [[totals], topSongs, topArtists, topCategories, timeline, origins] = await Promise.all([
    sql<
      {
        visitors: number;
        requesters: number;
        requests: number;
        played: number;
        accepted: number;
        rejected: number;
        pending: number;
        distinct_songs: number;
        comments: number;
        suggestions: number;
      }[]
    >`
      select
        (select count(distinct device_id) from visits where show_id = ${showId})::int as visitors,
        (select count(distinct device_id) from song_requests where show_id = ${showId})::int as requesters,
        (select count(*) from song_requests where show_id = ${showId})::int as requests,
        (select count(distinct song_id) from song_requests where show_id = ${showId} and status = 'played')::int as played,
        (select count(distinct song_id) from song_requests where show_id = ${showId} and status = 'accepted')::int as accepted,
        (select count(distinct song_id) from song_requests where show_id = ${showId} and status = 'rejected')::int as rejected,
        (select count(distinct song_id) from song_requests where show_id = ${showId} and status = 'pending')::int as pending,
        (select count(distinct song_id) from song_requests where show_id = ${showId})::int as distinct_songs,
        (select count(*) from comments where show_id = ${showId})::int as comments,
        (select count(*) from suggestions where show_id = ${showId})::int as suggestions`,
    sql<{ label: string; sub: string; value: number; status: string }[]>`
      select s.title as label, s.artist_credit as sub, count(*)::int as value, max(r.status) as status
      from song_requests r join songs s on s.id = r.song_id
      where r.show_id = ${showId}
      group by s.id order by value desc, min(r.created_at) limit 15`,
    sql<Ranked[]>`
      select a.name as label, count(*)::int as value
      from song_requests r join song_artists sa on sa.song_id = r.song_id join artists a on a.id = sa.artist_id
      where r.show_id = ${showId}
      group by a.name order by value desc limit 10`,
    sql<Ranked[]>`
      select s.category as label, count(*)::int as value
      from song_requests r join songs s on s.id = r.song_id
      where r.show_id = ${showId}
      group by s.category order by value desc`,
    sql<{ bucket: string; value: number }[]>`
      select to_char(date_bin('15 minutes', r.created_at at time zone 'America/Sao_Paulo', timestamp '2000-01-01'), 'HH24:MI') as bucket,
             count(*)::int as value
      from song_requests r where r.show_id = ${showId}
      group by date_bin('15 minutes', r.created_at at time zone 'America/Sao_Paulo', timestamp '2000-01-01')
      order by date_bin('15 minutes', r.created_at at time zone 'America/Sao_Paulo', timestamp '2000-01-01')`,
    sql<Ranked[]>`
      select case s.origin when 'nacional' then 'Nacional' when 'internacional' then 'Internacional' else 'Medleys' end as label,
             count(*)::int as value
      from song_requests r join songs s on s.id = r.song_id
      where r.show_id = ${showId}
      group by 1 order by value desc`,
  ]);
  return { totals, topSongs, topArtists, topCategories, timeline, origins };
}

export async function overallInsights() {
  const [[totals], topSongs, topArtists, perShow, neverRequested, topSuggestions] = await Promise.all([
    sql<{ shows: number; visitors: number; requests: number; requesters: number; played: number; comments: number; suggestions: number }[]>`
      select
        (select count(*) from shows where status <> 'draft')::int as shows,
        (select count(distinct device_id) from visits)::int as visitors,
        (select count(*) from song_requests)::int as requests,
        (select count(distinct device_id) from song_requests)::int as requesters,
        (select count(distinct (show_id, song_id)) from song_requests where status = 'played')::int as played,
        (select count(*) from comments)::int as comments,
        (select count(*) from suggestions)::int as suggestions`,
    sql<{ label: string; sub: string; value: number; shows: number }[]>`
      select s.title as label, s.artist_credit as sub, count(*)::int as value, count(distinct r.show_id)::int as shows
      from song_requests r join songs s on s.id = r.song_id
      group by s.id order by value desc limit 15`,
    sql<Ranked[]>`
      select a.name as label, count(*)::int as value
      from song_requests r join song_artists sa on sa.song_id = r.song_id join artists a on a.id = sa.artist_id
      group by a.name order by value desc limit 10`,
    sql<
      { id: number; show_date: string; venue: string; status: string; visitors: number; requesters: number; requests: number; played: number; top_song: string | null }[]
    >`
      select sh.id, sh.show_date, sh.venue, sh.status,
        (select count(distinct device_id) from visits v where v.show_id = sh.id)::int as visitors,
        (select count(distinct device_id) from song_requests r where r.show_id = sh.id)::int as requesters,
        (select count(*) from song_requests r where r.show_id = sh.id)::int as requests,
        (select count(distinct song_id) from song_requests r where r.show_id = sh.id and r.status = 'played')::int as played,
        (select s.title from song_requests r join songs s on s.id = r.song_id where r.show_id = sh.id
           group by s.id order by count(*) desc, min(r.created_at) limit 1) as top_song
      from shows sh where sh.status <> 'draft'
      order by sh.show_date desc, sh.id desc limit 30`,
    sql<{ title: string; artist_credit: string }[]>`
      select s.title, s.artist_credit from songs s
      where s.active and not exists (select 1 from song_requests r where r.song_id = s.id)
      order by s.title`,
    sql<{ label: string; sub: string | null; value: number }[]>`
      select min(title) as label, min(artist) as sub, count(*)::int as value
      from suggestions where status = 'new'
      group by lower(trim(title)) order by value desc, max(created_at) desc limit 10`,
  ]);
  return { totals, topSongs, topArtists, perShow, neverRequested, topSuggestions };
}
