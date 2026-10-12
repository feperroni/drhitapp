import { sql } from "./db";

export type CatalogSong = {
  id: number;
  title: string;
  credit: string;
  category: string;
  origin: string;
  medley: string | null;
};
export type CatalogArtist = { name: string; songIds: number[] };

/** Repertório ativo agrupado por artista; medleys formam um grupo próprio. */
export async function getCatalog() {
  const rows = await sql<(CatalogSong & { artists: string[] | null })[]>`
    select s.id, s.title, s.artist_credit as credit, s.category, s.origin, s.medley_items as medley,
           array_remove(array_agg(a.name order by a.name), null) as artists
    from songs s
    left join song_artists sa on sa.song_id = s.id
    left join artists a on a.id = sa.artist_id
    where s.active
    group by s.id
    order by s.title`;

  const byArtist = new Map<string, number[]>();
  const medleys: number[] = [];
  for (const r of rows) {
    if (r.origin === "medley") medleys.push(r.id);
    else for (const a of r.artists ?? []) byArtist.set(a, [...(byArtist.get(a) ?? []), r.id]);
  }

  const sortKey = (n: string) => n.replace(/^(the|os|o|a|as)\s+/i, "");
  const artists: CatalogArtist[] = [...byArtist]
    .map(([name, songIds]) => ({ name, songIds }))
    .sort((x, y) => sortKey(x.name).localeCompare(sortKey(y.name), "pt-BR"));

  const songs = rows.map(({ artists: _a, ...s }) => s);
  return { songs, artists, medleys };
}
