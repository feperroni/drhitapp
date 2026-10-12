import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { showInsights } from "@/lib/insights";
import { getShow } from "@/lib/shows";
import { closeShow, deleteShow, publishShow, updateShow } from "../../actions";
import { Bars, PageTitle, Tile, Timeline, fmtDate, fmtDateTime, pct } from "../../ui";

const STATUS_LABEL: Record<string, string> = { pending: "na fila", accepted: "aceita", played: "tocada", rejected: "recusada" };

export default async function ShowDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const show = Number.isInteger(id) ? await getShow(id) : null;
  if (!show) notFound();

  const [ins, comments, suggestions] = await Promise.all([
    showInsights(id),
    sql<{ id: number; name: string | null; message: string; created_at: string }[]>`
      select id, name, message, created_at from comments where show_id = ${id} order by created_at desc`,
    sql<{ id: number; title: string; artist: string | null; created_at: string }[]>`
      select id, title, artist, created_at from suggestions where show_id = ${id} order by created_at desc`,
  ]);
  const t = ins.totals;
  const insights = buildInsights(ins);

  return (
    <div className="space-y-5">
      <Link href="/admin/shows" className="text-sm text-muted hover:text-white">
        ← Shows
      </Link>
      <PageTitle sub={`${fmtDate(show.show_date)} · ${show.status === "live" ? "AO VIVO" : show.status === "closed" ? "encerrado" : "rascunho"}`}>
        {show.venue}
      </PageTitle>

      <div className="flex flex-wrap gap-2">
        {show.status === "live" ? (
          <>
            <Link href="/admin/ao-vivo" className="btn-hit text-sm">
              Painel ao vivo
            </Link>
            <form action={closeShow}>
              <input type="hidden" name="id" value={show.id} />
              <button className="btn-ghost text-sm">Encerrar show</button>
            </form>
          </>
        ) : (
          <form action={publishShow}>
            <input type="hidden" name="id" value={show.id} />
            <button className="btn-gold text-sm">{show.status === "closed" ? "Reabrir show" : "Publicar show"}</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Acessos" value={t.visitors} hint="pessoas únicas" />
        <Tile label="Pediram" value={t.requesters} hint={`${pct(t.requesters, t.visitors)} de quem acessou`} />
        <Tile label="Pedidos" value={t.requests} hint={`${t.distinct_songs} músicas diferentes`} />
        <Tile label="Tocadas" value={t.played} hint={`${pct(t.played, t.distinct_songs)} das pedidas`} />
        <Tile label="Recados" value={t.comments} hint={`${t.suggestions} sugestões`} />
      </div>

      {insights.length > 0 && (
        <section className="card border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-4">
          <h3 className="label text-gold">Insights do show</h3>
          <ul className="space-y-1.5 text-sm">
            {insights.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars
          title="Músicas mais pedidas"
          rows={ins.topSongs.map((s) => ({
            label: s.label,
            sub: s.sub,
            value: s.value,
            extra: <span className="shrink-0 text-[10px] uppercase text-muted">{STATUS_LABEL[s.status]}</span>,
          }))}
        />
        <div className="space-y-4">
          <Timeline rows={ins.timeline} />
          <Bars title="Artistas mais pedidos" rows={ins.topArtists} color="bg-gold" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Estilos mais pedidos" rows={ins.topCategories} color="bg-gold" />
        <Bars title="Nacional × internacional" rows={ins.origins} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="label mb-3">Recados deste show ({comments.length})</h3>
          {comments.length === 0 ? (
            <p className="text-sm text-muted">Nenhum recado.</p>
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.id} className="rounded-xl bg-panel-2 p-3">
                  <p className="whitespace-pre-wrap text-sm">{c.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    {c.name ?? "Anônimo"} · {fmtDateTime(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h3 className="label mb-3">Sugestões deste show ({suggestions.length})</h3>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma sugestão.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <b>{s.title}</b> {s.artist && <span className="text-muted">— {s.artist}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Editar show</summary>
        <form action={updateShow} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="id" value={show.id} />
          <label>
            <span className="label">Data</span>
            <input type="date" name="show_date" defaultValue={show.show_date} required className="input" />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Local</span>
            <input name="venue" defaultValue={show.venue} required className="input" />
          </label>
          <label>
            <span className="label">Pedidos/pessoa</span>
            <input type="number" min={1} name="requests_per_person" defaultValue={show.requests_per_person} className="input" />
          </label>
          <label>
            <span className="label">A cada (min)</span>
            <input type="number" min={1} name="window_minutes" defaultValue={show.window_minutes} className="input" />
          </label>
          <label>
            <span className="label">Limite do show</span>
            <input type="number" min={1} name="max_requests" defaultValue={show.max_requests ?? ""} placeholder="sem limite" className="input" />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button className="btn-gold">Salvar alterações</button>
          </div>
        </form>
        <form action={deleteShow} className="mt-6 border-t border-line pt-4">
          <input type="hidden" name="id" value={show.id} />
          <button className="text-sm text-red-400 hover:underline">Excluir este show e todos os seus pedidos</button>
        </form>
      </details>
    </div>
  );
}

function buildInsights(ins: Awaited<ReturnType<typeof showInsights>>) {
  const out: string[] = [];
  const t = ins.totals;
  if (!t.requests) return out;
  const top = ins.topSongs[0];
  if (top) out.push(`A mais pedida foi “${top.label}” (${top.sub}) com ${top.value} pedido${top.value > 1 ? "s" : ""}.`);
  const art = ins.topArtists[0];
  if (art) out.push(`${art.label} foi o artista favorito da noite (${pct(art.value, t.requests)} dos pedidos).`);
  const cat = ins.topCategories[0];
  if (cat) out.push(`O estilo que mais bombou: ${cat.label} (${pct(cat.value, t.requests)}).`);
  const peak = ins.timeline.reduce((a, b) => (b.value > a.value ? b : a), ins.timeline[0]);
  if (peak) out.push(`Horário de pico de pedidos: ${peak.bucket}.`);
  if (t.visitors) out.push(`${pct(t.requesters, t.visitors)} de quem abriu o app fez pelo menos um pedido.`);
  const missed = t.pending + t.accepted;
  if (missed) out.push(missed > 1 ? `${missed} músicas pedidas ficaram sem tocar.` : "1 música pedida ficou sem tocar.");
  const repeat = ins.topSongs.filter((s) => s.value > 1).length;
  if (repeat) out.push(`${repeat} música${repeat > 1 ? "s foram pedidas" : " foi pedida"} por mais de uma pessoa.`);
  return out;
}
