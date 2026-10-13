// Cria/atualiza as tabelas e, se o repertório estiver vazio, carrega db/repertorio.json.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const root = new URL("../db/", import.meta.url);

try {
  await sql.unsafe(readFileSync(new URL("schema.sql", root), "utf8"));

  const defaults = {
    band_name: "Doctor Hit",
    instagram: "bandadrhit",
    pix_key: "vinivico82@gmail.com",
    pix_name: "Banda Dr Hit",
    pix_city: "Sao Paulo",
    contact_label: "Contato para shows",
    contact_name: "Vico Guitarrista",
    contact_whatsapp: "(11) 96300-5001",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do nothing`;
  }
  // corrige o número digitado errado na primeira versão (só se ainda não foi editado na console)
  await sql`update settings set value = '(11) 96300-5001'
            where key = 'contact_whatsapp' and value = '(11) 963005-5001'`;

  const [{ count }] = await sql`select count(*)::int as count from songs`;
  if (count === 0) {
    const songs = JSON.parse(readFileSync(new URL("repertorio.json", root), "utf8"));
    await sql.begin(async (tx) => {
      for (const s of songs) {
        const [{ id }] = await tx`
          insert into songs (title, artist_credit, category, origin, medley_items)
          values (${s.title}, ${s.credit}, ${s.category}, ${s.origin}, ${s.medley ?? null})
          returning id`;
        for (const name of s.artists ?? [s.credit]) {
          const [artist] = await tx`
            insert into artists (name) values (${name})
            on conflict (name) do update set name = excluded.name
            returning id`;
          await tx`insert into song_artists (song_id, artist_id) values (${id}, ${artist.id}) on conflict do nothing`;
        }
      }
    });
    console.log(`Repertório carregado: ${songs.length} músicas`);
  }
  console.log("Migração concluída");
} finally {
  await sql.end();
}
