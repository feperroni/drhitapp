import Link from "next/link";
import { sql } from "@/lib/db";
import { deleteSong, saveSong, toggleSong } from "../actions";
import { PageTitle } from "../ui";
import RepertoireFilter from "./RepertoireFilter";

type Row = {
  id: number;
  title: string;
  artist_credit: string;
  category: string;
  origin: string;
  medley_items: string | null;
  active: boolean;
  artists: string[];
  requests: number;
};

export default async function RepertorioPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; title?: string; artist?: string; suggestion?: string }>;
}) {
  const sp = await searchParams;
  const songs = await sql<Row[]>`
    select s.*, coalesce(array_agg(a.name order by a.name) filter (where a.name is not null), '{}') as artists,
           (select count(*) from song_requests r where r.song_id = s.id)::int as requests
    from songs s
    left join song_artists sa on sa.song_id = s.id
    left join artists a on a.id = sa.artist_id
    group by s.id
    order by s.category, s.title`;
  const categories = [...new Set(songs.map((s) => s.category))];
  const editing = sp.edit ? songs.find((s) => s.id === Number(sp.edit)) : undefined;
  const fromSuggestion = !editing && (sp.title || sp.suggestion);
  const active = songs.filter((s) => s.active).length;

  const byCategory = new Map<string, Row[]>();
  for (const s of songs) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);

  return (
    <div className="space-y-6">
      <PageTitle sub={`${active} músicas ativas de ${songs.length}. Alterações aparecem na hora no app da plateia.`}>Repertório</PageTitle>

      <form action={saveSong} id="form" className="card grid gap-3 p-4 sm:grid-cols-2" key={editing?.id ?? sp.title ?? "new"}>
        <h2 className="label sm:col-span-2">
          {editing ? `Editando: ${editing.title}` : fromSuggestion ? "Adicionar música sugerida" : "Adicionar música"}
        </h2>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        {sp.suggestion && <input type="hidden" name="suggestion_id" value={sp.suggestion} />}
        <input type="hidden" name="redirect" value="/admin/repertorio" />
        <label>
          <span className="label">Música *</span>
          <input name="title" required defaultValue={editing?.title ?? sp.title ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Artista(s): separe com “;”</span>
          <input
            name="artists"
            defaultValue={editing?.artists.join("; ") ?? sp.artist ?? ""}
            placeholder="Ex.: Queen; David Bowie"
            className="input"
          />
        </label>
        <label>
          <span className="label">Como exibir o artista (opcional)</span>
          <input name="credit" defaultValue={editing?.artist_credit ?? ""} placeholder="Ex.: Queen & David Bowie" className="input" />
        </label>
        <label>
          <span className="label">Categoria *</span>
          <input name="category" list="cats" required defaultValue={editing?.category ?? ""} className="input" />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="label">Tipo</span>
          <select name="origin" defaultValue={editing?.origin ?? "nacional"} className="input">
            <option value="nacional">Nacional</option>
            <option value="internacional">Internacional</option>
            <option value="medley">Medley / bloco especial</option>
          </select>
        </label>
        <label>
          <span className="label">Músicas do medley (se for medley)</span>
          <input name="medley_items" defaultValue={editing?.medley_items ?? ""} className="input" />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-gold">{editing ? "Salvar alterações" : "Adicionar ao repertório"}</button>
          {(editing || fromSuggestion) && (
            <Link href="/admin/repertorio" className="btn-ghost">
              Cancelar
            </Link>
          )}
        </div>
      </form>

      <RepertoireFilter />

      {[...byCategory].map(([cat, list]) => (
        <section key={cat} data-section>
          <h2 className="label mb-2 text-gold">
            {cat} ({list.length})
          </h2>
          <ul className="card divide-y divide-line">
            {list.map((s) => (
              <li
                key={s.id}
                data-song={`${s.title} ${s.artist_credit}`.toLowerCase()}
                className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${s.active ? "" : "opacity-50"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {s.title} {!s.active && <span className="ml-1 rounded bg-zinc-700 px-1.5 text-[10px] uppercase">inativa</span>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {s.medley_items ?? s.artist_credit} · {s.requests} pedido{s.requests === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Link href={`/admin/repertorio?edit=${s.id}#form`} className="rounded-lg px-2 py-1 text-muted hover:bg-panel-2 hover:text-white">
                    Editar
                  </Link>
                  <form action={toggleSong}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg px-2 py-1 text-muted hover:bg-panel-2 hover:text-white">
                      {s.active ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                  <form action={deleteSong}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      className="rounded-lg px-2 py-1 text-red-400 hover:bg-panel-2"
                      title={s.requests ? "Já tem pedidos: será apenas desativada para manter o histórico" : "Remover"}
                    >
                      Remover
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
