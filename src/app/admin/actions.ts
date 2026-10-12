"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { emit } from "@/lib/events";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
function time(fd: FormData, key: string) {
  const v = str(fd, key);
  return /^\d{2}:\d{2}$/.test(v) ? v : null;
}
function int(fd: FormData, key: string, fallback: number | null) {
  const v = str(fd, key);
  if (!v) return fallback;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- Shows ----------

export async function createShow(fd: FormData) {
  const date = str(fd, "show_date");
  const venue = str(fd, "venue");
  if (!date || !venue) return;
  const [show] = await sql<{ id: number }[]>`
    insert into shows (show_date, venue, start_time, end_time, announce, requests_per_person, window_minutes, max_requests)
    values (${date}, ${venue}, ${time(fd, "start_time")}, ${time(fd, "end_time")}, ${fd.get("announce") === "on"},
            ${int(fd, "requests_per_person", 1)}, ${int(fd, "window_minutes", 60)}, ${int(fd, "max_requests", null)})
    returning id`;
  for (const p of parsePromoLines(str(fd, "promotions"))) {
    await sql`insert into promotions (show_id, title, description)
              values (${show.id}, ${p.title.slice(0, 120)}, ${p.description?.slice(0, 500) ?? null})`;
  }
  if (fd.get("publish")) await publish(show.id);
  revalidatePath("/admin", "layout");
}

export async function updateShow(fd: FormData) {
  const id = Number(fd.get("id"));
  await sql`
    update shows set
      show_date = ${str(fd, "show_date")},
      venue = ${str(fd, "venue")},
      start_time = ${time(fd, "start_time")},
      end_time = ${time(fd, "end_time")},
      announce = ${fd.get("announce") === "on"},
      requests_per_person = ${int(fd, "requests_per_person", 1)},
      window_minutes = ${int(fd, "window_minutes", 60)},
      max_requests = ${int(fd, "max_requests", null)}
    where id = ${id}`;
  emit({ type: "queue", showId: id });
  revalidatePath("/admin", "layout");
}

async function publish(id: number) {
  await sql.begin(async (tx) => {
    await tx`update shows set status = 'closed', closed_at = now() where status = 'live' and id <> ${id}`;
    await tx`update shows set status = 'live', published_at = coalesce(published_at, now()), closed_at = null where id = ${id}`;
  });
  emit({ type: "show" });
}

export async function publishShow(fd: FormData) {
  await publish(Number(fd.get("id")));
  revalidatePath("/admin", "layout");
}

export async function closeShow(fd: FormData) {
  await sql`update shows set status = 'closed', closed_at = now() where id = ${Number(fd.get("id"))}`;
  emit({ type: "show" });
  revalidatePath("/admin", "layout");
}

export async function deleteShow(fd: FormData) {
  await sql`delete from shows where id = ${Number(fd.get("id"))}`;
  emit({ type: "show" });
  revalidatePath("/admin", "layout");
  redirect("/admin/shows");
}

// ---------- Repertório ----------

async function linkArtists(tx: typeof sql | any, songId: number, names: string[]) {
  await tx`delete from song_artists where song_id = ${songId}`;
  for (const name of names) {
    const [a] = await tx`
      insert into artists (name) values (${name})
      on conflict (name) do update set name = excluded.name returning id`;
    await tx`insert into song_artists (song_id, artist_id) values (${songId}, ${a.id}) on conflict do nothing`;
  }
  await tx`delete from artists a where not exists (select 1 from song_artists sa where sa.artist_id = a.id)`;
}

function parseArtists(fd: FormData) {
  return [...new Set(str(fd, "artists").split(/[;\n]/).map((s) => s.trim()).filter(Boolean))];
}

export async function saveSong(fd: FormData) {
  const id = Number(fd.get("id")) || null;
  const title = str(fd, "title");
  const artists = parseArtists(fd);
  const origin = str(fd, "origin") || "nacional";
  const credit = str(fd, "credit") || artists.join(" / ") || "Medley";
  const category = str(fd, "category") || "Outros";
  const medley = str(fd, "medley_items") || null;
  if (!title) return;

  await sql.begin(async (tx) => {
    let songId = id;
    if (songId) {
      await tx`
        update songs set title = ${title}, artist_credit = ${credit}, category = ${category},
                         origin = ${origin}, medley_items = ${medley}
        where id = ${songId}`;
    } else {
      const [row] = await tx<{ id: number }[]>`
        insert into songs (title, artist_credit, category, origin, medley_items)
        values (${title}, ${credit}, ${category}, ${origin}, ${medley}) returning id`;
      songId = row.id;
    }
    await linkArtists(tx, songId!, artists);
  });

  const suggestionId = Number(fd.get("suggestion_id"));
  if (suggestionId) await sql`update suggestions set status = 'added' where id = ${suggestionId}`;

  revalidatePath("/", "layout");
  if (fd.get("redirect")) redirect(String(fd.get("redirect")));
}

export async function toggleSong(fd: FormData) {
  await sql`update songs set active = not active where id = ${Number(fd.get("id"))}`;
  revalidatePath("/", "layout");
}

export async function deleteSong(fd: FormData) {
  const id = Number(fd.get("id"));
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from song_requests where song_id = ${id}`;
  if (n > 0) {
    // mantém o histórico de pedidos: apenas desativa
    await sql`update songs set active = false where id = ${id}`;
  } else {
    await sql`delete from songs where id = ${id}`;
    await sql`delete from artists a where not exists (select 1 from song_artists sa where sa.artist_id = a.id)`;
  }
  revalidatePath("/", "layout");
}

// ---------- Sugestões e recados ----------

export async function setSuggestionStatus(fd: FormData) {
  await sql`update suggestions set status = ${str(fd, "status")} where id = ${Number(fd.get("id"))}`;
  revalidatePath("/admin/sugestoes");
}

export async function markCommentsRead(fd: FormData) {
  const id = Number(fd.get("id"));
  if (id) await sql`update comments set read = not read where id = ${id}`;
  else await sql`update comments set read = true where not read`;
  revalidatePath("/admin", "layout");
}

// ---------- Configurações ----------

export async function saveSettings(fd: FormData) {
  for (const key of ["band_name", "instagram", "pix_key", "pix_name", "pix_city"]) {
    let value = str(fd, key);
    if (key === "instagram") value = value.replace(/^@/, "");
    if (value) {
      await sql`insert into settings (key, value) values (${key}, ${value})
                on conflict (key) do update set value = excluded.value`;
    }
  }
  revalidatePath("/", "layout");
}

// ---------- Promoções do show ----------

/** Linhas "Título — descrição" (ou "Título: descrição") viram promoções. */
function parsePromoLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s+[—–-]\s+(.+)$/) ?? l.match(/^([^:]+):\s*(.+)$/);
      return m ? { title: m[1].trim(), description: m[2].trim() } : { title: l, description: null };
    });
}

export async function addPromotion(fd: FormData) {
  const showId = Number(fd.get("show_id"));
  const title = str(fd, "title").slice(0, 120);
  if (!showId || !title) return;
  await sql`
    insert into promotions (show_id, title, description)
    values (${showId}, ${title}, ${str(fd, "description").slice(0, 500) || null})`;
  emit({ type: "show" });
  revalidatePath("/admin", "layout");
}

export async function togglePromotion(fd: FormData) {
  await sql`update promotions set active = not active where id = ${Number(fd.get("id"))}`;
  emit({ type: "show" });
  revalidatePath("/admin", "layout");
}

export async function deletePromotion(fd: FormData) {
  await sql`delete from promotions where id = ${Number(fd.get("id"))}`;
  emit({ type: "show" });
  revalidatePath("/admin", "layout");
}
