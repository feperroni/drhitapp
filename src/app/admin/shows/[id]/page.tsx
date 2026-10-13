import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "../../ConfirmButton";
import { sql } from "@/lib/db";
import { showInsights } from "@/lib/insights";
import { getShow } from "@/lib/shows";
import {
  addPromotion,
  closeShow,
  copyMerchItems,
  deleteMerchItem,
  deletePromotion,
  deleteShow,
  publishShow,
  saveMerchItem,
  toggleMerchSoldOut,
  togglePromotion,
  updateShow,
} from "../../actions";
import { Bars, PageTitle, Tile, Timeline, brl, fmtDate, fmtDateTime, fmtTimeRange, pct } from "../../ui";

const STATUS_LABEL: Record<string, string> = { pending: "na fila", accepted: "aceita", played: "tocada", rejected: "recusada" };

export default async function ShowDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const show = Number.isInteger(id) ? await getShow(id) : null;
  if (!show) notFound();

  const [ins, comments, suggestions, promos, merch, merchSources] = await Promise.all([
    showInsights(id),
    sql<{ id: number; name: string | null; message: string; created_at: string }[]>`
      select id, name, message, created_at from comments where show_id = ${id} order by created_at desc`,
    sql<{ id: number; title: string; artist: string | null; created_at: string }[]>`
      select id, title, artist, created_at from suggestions where show_id = ${id} order by created_at desc`,
    sql<{ id: number; title: string; description: string | null; active: boolean }[]>`
      select id, title, description, active from promotions where show_id = ${id} order by created_at`,
    sql<{ id: number; name: string; description: string | null; price_cents: number; sold_out: boolean; image: string | null }[]>`
      select id, name, description, price_cents, sold_out,
             case when image is not null
               then '/api/merch/' || id || '/image?v=' || extract(epoch from updated_at)::bigint end as image
      from merch_items where show_id = ${id} order by id`,
    // shows anteriores com itens, para copiar a loja
    sql<{ id: number; venue: string; show_date: string; items: number }[]>`
      select s.id, s.venue, s.show_date, count(m.id)::int as items
      from shows s join merch_items m on m.show_id = s.id
      where s.id <> ${id}
      group by s.id order by s.show_date desc, s.id desc limit 10`,
  ]);
  const t = ins.totals;
  const insights = buildInsights(ins);

  return (
    <div className="space-y-5">
      <Link href={`/admin/shows?d=${show.show_date}`} className="text-sm text-muted hover:text-white">
        ← Shows da semana
      </Link>
      <PageTitle sub={`${fmtDate(show.show_date)}${fmtTimeRange(show.start_time, show.end_time) ? ` · ${fmtTimeRange(show.start_time, show.end_time)}` : ""} · ${show.status === "live" ? "AO VIVO" : show.status === "closed" ? "encerrado" : "rascunho"}`}>
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
        <a href="#loja" className="btn-ghost text-sm">🛍️ Loja</a>
        <a href="#promocoes" className="btn-ghost text-sm">🎁 Promoções</a>
        <a href="#insights" className="btn-ghost text-sm">📊 Insights</a>
        <a href="#editar" className="btn-ghost text-sm">✏️ Editar</a>
      </div>

      <section id="promocoes" className="card scroll-mt-4 p-4">
        <h3 className="label mb-1">🎁 Promoções exclusivas do app</h3>
        <p className="mb-3 text-xs text-muted">
          Aparecem na aba <b>Promo</b> do app enquanto este show estiver ao vivo. A pessoa mostra a tela no balcão para ganhar.
        </p>
        {promos.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {promos.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${p.active ? "" : "opacity-50"}`}>
                <div className="min-w-[12rem] flex-1">
                  <div className="font-semibold">
                    {p.title} {!p.active && <span className="ml-1 rounded bg-zinc-700 px-1.5 text-[10px] uppercase">pausada</span>}
                  </div>
                  {p.description && <div className="text-sm text-muted">{p.description}</div>}
                </div>
                <form action={togglePromotion}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-panel-2 hover:text-white">
                    {p.active ? "Pausar" : "Reativar"}
                  </button>
                </form>
                <form action={deletePromotion}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-panel-2">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addPromotion} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input type="hidden" name="show_id" value={show.id} />
          <input name="title" required maxLength={120} placeholder="Título (ex.: Chopp em dobro)" className="input" />
          <input name="description" maxLength={500} placeholder="Detalhes (ex.: 2 por 1 até as 23h, no bar)" className="input" />
          <button className="btn-gold">Adicionar</button>
        </form>
      </section>

      <section id="loja" className="card scroll-mt-4 border-gold/40 p-4">
        <h3 className="label mb-1">🛍️ Loja da banda neste show</h3>
        <p className="mb-3 text-xs text-muted">
          Itens à venda (copos, camisetas, adesivos…). Aparecem na aba <b>Loja</b> do app enquanto este show estiver ao vivo.
        </p>

        {merch.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {merch.map((m) => (
              <li key={m.id} className={`p-3 ${m.sold_out ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-2xl">🛍️</div>
                  )}
                  <div className="min-w-[10rem] flex-1">
                    <div className="font-semibold">
                      {m.name}{" "}
                      {m.sold_out && <span className="ml-1 rounded bg-zinc-700 px-1.5 text-[10px] uppercase">esgotado</span>}
                    </div>
                    <div className="text-sm text-gold">{brl(m.price_cents)}</div>
                    {m.description && <div className="text-xs text-muted">{m.description}</div>}
                  </div>
                  <form action={toggleMerchSoldOut}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-panel-2 hover:text-white">
                      {m.sold_out ? "Voltou ao estoque" : "Marcar esgotado"}
                    </button>
                  </form>
                  <form action={deleteMerchItem}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-panel-2">Remover</button>
                  </form>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gold">Editar</summary>
                  <form action={saveMerchItem} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={m.id} />
                    <label>
                      <span className="label">Nome</span>
                      <input name="name" required maxLength={120} defaultValue={m.name} className="input" />
                    </label>
                    <label>
                      <span className="label">Preço (R$)</span>
                      <input
                        name="price"
                        inputMode="decimal"
                        defaultValue={(m.price_cents / 100).toFixed(2).replace(".", ",")}
                        className="input"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="label">Descrição</span>
                      <input name="description" maxLength={500} defaultValue={m.description ?? ""} className="input" />
                    </label>
                    <label>
                      <span className="label">Trocar foto</span>
                      <input type="file" name="image" accept="image/*" className="input py-2 text-sm" />
                    </label>
                    {m.image && (
                      <label className="flex items-center gap-2 self-end pb-3 text-sm">
                        <input type="checkbox" name="remove_image" className="h-4 w-4" /> Remover foto
                      </label>
                    )}
                    <div className="sm:col-span-2">
                      <button className="btn-gold text-sm">Salvar item</button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}

        <form action={saveMerchItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="show_id" value={show.id} />
          <label>
            <span className="label">Item</span>
            <input name="name" required maxLength={120} placeholder="Ex.: Copo Dr. Hit" className="input" />
          </label>
          <label>
            <span className="label">Preço (R$)</span>
            <input name="price" inputMode="decimal" placeholder="25,00" className="input" />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Descrição (opcional)</span>
            <input name="description" maxLength={500} placeholder="Ex.: Copo de 500 ml, edição limitada" className="input" />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Foto (opcional)</span>
            <input type="file" name="image" accept="image/*" className="input py-2 text-sm" />
          </label>
          <div className="flex items-end">
            <button className="btn-gold">Adicionar item</button>
          </div>
        </form>

        {merchSources.length > 0 && (
          <form action={copyMerchItems} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <input type="hidden" name="show_id" value={show.id} />
            <label className="min-w-[14rem] flex-1">
              <span className="label">Copiar itens de outro show</span>
              <select name="from_show_id" className="input">
                {merchSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.show_date.split("-").reverse().join("/")} · {s.venue} ({s.items} {s.items === 1 ? "item" : "itens"})
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-ghost">Copiar para este show</button>
          </form>
        )}
      </section>

      <div id="insights" className="grid scroll-mt-4 grid-cols-2 gap-3 lg:grid-cols-5">
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

      <details id="editar" className="card scroll-mt-4 p-4">
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
            <span className="label">Início</span>
            <input type="time" name="start_time" defaultValue={show.start_time?.slice(0, 5) ?? ""} className="input" />
          </label>
          <label>
            <span className="label">Fim</span>
            <input type="time" name="end_time" defaultValue={show.end_time?.slice(0, 5) ?? ""} className="input" />
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="announce" defaultChecked={show.announce} className="h-4 w-4 accent-[var(--color-gold)]" />
            Divulgar na agenda
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
          <input type="hidden" name="back" value={`/admin/shows?d=${show.show_date}`} />
          <ConfirmButton
            message={`Excluir o show "${show.venue}"? Os pedidos, promoções e itens da loja dele também serão apagados.`}
            className="text-sm text-red-400 hover:underline"
          >
            Excluir este show e todos os seus pedidos
          </ConfirmButton>
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
