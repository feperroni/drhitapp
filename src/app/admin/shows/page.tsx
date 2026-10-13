import Link from "next/link";
import { sql } from "@/lib/db";
import {
  addDays,
  addMonths,
  fmtDayMonth,
  fmtMonth,
  fmtWeekday,
  isDate,
  isMonth,
  mondayOf,
  monthOf,
  monthRange,
  todaySP,
} from "@/lib/dates";
import type { Show } from "@/lib/shows";
import { closeShow, createShow, deleteShow, duplicateShow, publishShow } from "../actions";
import ConfirmButton from "../ConfirmButton";
import { PageTitle, fmtTimeRange } from "../ui";

const STATUS = {
  draft: { label: "Rascunho", cls: "bg-zinc-700 text-zinc-200" },
  live: { label: "Ao vivo", cls: "bg-hit text-white" },
  closed: { label: "Encerrado", cls: "bg-panel-2 text-muted border border-line" },
};

type Row = Show & { requests: number; visitors: number; promos: number; merch: number };

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; d?: string; m?: string; novo?: string }>;
}) {
  const sp = await searchParams;
  const today = todaySP();
  const view = sp.view === "mes" ? "mes" : "semana";

  // Período exibido
  let start: string, end: string, label: string, prevHref: string, nextHref: string, current: string;
  const month = isMonth(sp.m) ? sp.m : monthOf(isDate(sp.d) ? sp.d : today);
  if (view === "semana") {
    start = mondayOf(isDate(sp.d) ? sp.d : today);
    end = addDays(start, 6);
    label = `${fmtDayMonth(start)} a ${fmtDayMonth(end)}`;
    prevHref = `/admin/shows?d=${addDays(start, -7)}`;
    nextHref = `/admin/shows?d=${addDays(start, 7)}`;
    current = `/admin/shows?d=${start}`;
  } else {
    [start, end] = monthRange(month);
    label = fmtMonth(month);
    prevHref = `/admin/shows?view=mes&m=${addMonths(month, -1)}`;
    nextHref = `/admin/shows?view=mes&m=${addMonths(month, 1)}`;
    current = `/admin/shows?view=mes&m=${month}`;
  }
  const novo = isDate(sp.novo) ? sp.novo : null;

  const [shows, [live]] = await Promise.all([
    sql<Row[]>`
      select sh.*,
        (select count(*) from song_requests r where r.show_id = sh.id)::int as requests,
        (select count(distinct device_id) from visits v where v.show_id = sh.id)::int as visitors,
        (select count(*) from promotions p where p.show_id = sh.id and p.active)::int as promos,
        (select count(*) from merch_items m where m.show_id = sh.id)::int as merch
      from shows sh
      where sh.show_date between ${start} and ${end}
      order by sh.show_date, sh.start_time nulls last, sh.id`,
    sql<Show[]>`select * from shows where status = 'live' limit 1`,
  ]);

  const byDay = new Map<string, Row[]>();
  for (const s of shows) byDay.set(s.show_date, [...(byDay.get(s.show_date) ?? []), s]);
  const totalRequests = shows.reduce((n, s) => n + s.requests, 0);

  // Semana: os 7 dias (inclusive vazios). Mês: só dias com show, agrupados por semana.
  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [...byDay.keys()];
  const weeks = new Map<string, string[]>();
  for (const d of days) {
    const w = mondayOf(d);
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  }

  return (
    <div className="space-y-5">
      <PageTitle sub="Cadastre os shows e publique na hora do show: a partir daí, os pedidos, promoções e a loja valem para ele.">
        Shows
      </PageTitle>

      {live && (
        <div className="card flex flex-wrap items-center gap-3 border-hit/60 bg-gradient-to-r from-hit/15 to-transparent px-4 py-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-hit" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-widest text-red-300">Ao vivo agora</span>
            <div className="font-semibold">
              {live.venue} · {fmtDayMonth(live.show_date)}
            </div>
          </div>
          <Link href="/admin/ao-vivo" className="btn-hit text-sm">
            Painel ao vivo
          </Link>
          <Link href={`/admin/shows/${live.id}`} className="btn-ghost text-sm">
            Promoções e loja
          </Link>
        </div>
      )}

      {/* Barra de navegação do período */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex rounded-xl border border-line p-0.5 text-sm">
          <Link
            href={`/admin/shows?d=${view === "mes" ? `${month}-01` : start}`}
            className={`rounded-lg px-3 py-1.5 font-semibold ${view === "semana" ? "bg-gold text-black" : "text-muted hover:text-white"}`}
          >
            Semana
          </Link>
          <Link
            href={`/admin/shows?view=mes&m=${month}`}
            className={`rounded-lg px-3 py-1.5 font-semibold ${view === "mes" ? "bg-gold text-black" : "text-muted hover:text-white"}`}
          >
            Mês
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Link href={prevHref} className="btn-ghost px-3 py-1.5" aria-label="Período anterior">
            ‹
          </Link>
          <div className="min-w-[9.5rem] text-center font-display text-lg font-bold uppercase">{label}</div>
          <Link href={nextHref} className="btn-ghost px-3 py-1.5" aria-label="Próximo período">
            ›
          </Link>
        </div>

        <Link href={view === "mes" ? `/admin/shows?view=mes&m=${monthOf(today)}` : "/admin/shows"} className="text-sm text-gold hover:underline">
          Hoje
        </Link>

        {view === "mes" ? (
          <form action="/admin/shows" className="flex items-center gap-2">
            <input type="hidden" name="view" value="mes" />
            <input type="month" name="m" defaultValue={month} className="input w-auto py-1.5" />
            <button className="btn-ghost px-3 py-1.5 text-sm">Ir</button>
          </form>
        ) : (
          <form action="/admin/shows" className="flex items-center gap-2">
            <input type="date" name="d" defaultValue={start} className="input w-auto py-1.5" />
            <button className="btn-ghost px-3 py-1.5 text-sm">Ir</button>
          </form>
        )}

        <div className="ml-auto text-sm text-muted">
          {shows.length} show{shows.length === 1 ? "" : "s"} · {totalRequests} pedido{totalRequests === 1 ? "" : "s"}
        </div>
      </div>

      {/* Novo show (recolhido; abre ao clicar em "+ show" num dia) */}
      <details id="novo" open={!!novo} className="card p-4 [&[open]>summary]:mb-3">
        <summary className="cursor-pointer font-semibold text-gold">+ Novo show</summary>
        <form action={createShow} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="lg:col-span-1">
            <span className="label">Data</span>
            <input type="date" name="show_date" defaultValue={novo ?? (view === "semana" && today < start ? start : today)} required className="input" />
          </label>
          <label className="lg:col-span-3">
            <span className="label">Local</span>
            <input name="venue" required placeholder="Ex.: Bar do Zé, Pinheiros" className="input" />
          </label>
          <label>
            <span className="label">Início</span>
            <input type="time" name="start_time" className="input" />
          </label>
          <label>
            <span className="label">Fim</span>
            <input type="time" name="end_time" className="input" />
          </label>
          <label>
            <span className="label">Pedidos/pessoa</span>
            <input type="number" min={1} name="requests_per_person" defaultValue={1} className="input" />
          </label>
          <label>
            <span className="label">A cada (min)</span>
            <input type="number" min={1} name="window_minutes" defaultValue={60} className="input" />
          </label>
          <label>
            <span className="label">Limite do show</span>
            <input type="number" min={1} name="max_requests" placeholder="sem limite" className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" name="announce" defaultChecked className="h-4 w-4 accent-[var(--color-gold)]" />
            Divulgar na agenda (aba Shows) do app
          </label>
          <label className="sm:col-span-2 lg:col-span-6">
            <span className="label">🎁 Promoções exclusivas do app (opcional, uma por linha)</span>
            <textarea
              name="promotions"
              rows={2}
              className="input"
              placeholder={"Chopp em dobro — Mostre esta tela no bar e ganhe 2 chopps pelo preço de 1 até 23h"}
            />
            <span className="mt-1 block text-xs text-muted">
              Use “Título — descrição”. Itens da 🛍️ loja são cadastrados depois de salvar, pelo botão “Loja” do show (dá para copiar
              de outro show).
            </span>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
            <button className="btn-gold">Salvar show</button>
            <button name="publish" value="1" className="btn-hit">
              Salvar e publicar agora
            </button>
          </div>
        </form>
      </details>

      {/* Lista do período */}
      {days.length === 0 && (
        <div className="card px-4 py-10 text-center text-muted">Nenhum show em {label.toLowerCase()}.</div>
      )}

      {[...weeks].map(([weekStart, weekDays]) => (
        <section key={weekStart} className="space-y-3">
          {view === "mes" && (
            <h2 className="flex items-center gap-2 border-b border-line pb-1 text-sm font-semibold text-muted">
              Semana de {fmtDayMonth(weekStart)} a {fmtDayMonth(addDays(weekStart, 6))}
              <Link href={`/admin/shows?d=${weekStart}`} className="text-xs font-normal text-gold hover:underline">
                ver semana
              </Link>
            </h2>
          )}
          {weekDays.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className="grid gap-2 sm:grid-cols-[6.5rem_1fr]">
                <div className={`pt-1 ${d === today ? "text-gold" : "text-muted"}`}>
                  <div className="text-xs font-bold uppercase">{fmtWeekday(d)}</div>
                  <div className="font-display text-xl font-bold">{fmtDayMonth(d)}</div>
                  {d === today && <div className="text-[10px] font-bold uppercase">hoje</div>}
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <Link
                      href={`${current}&novo=${d}#novo`}
                      className="flex items-center rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:border-gold hover:text-gold"
                    >
                      Sem show · + adicionar show neste dia
                    </Link>
                  ) : (
                    list.map((s) => <ShowCard key={s.id} s={s} back={current} />)
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ShowCard({ s, back }: { s: Row; back: string }) {
  const time = fmtTimeRange(s.start_time, s.end_time);
  return (
    <div className={`card p-3 ${s.status === "live" ? "border-hit/60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[13rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
            {time && <span className="text-sm text-muted">{time}</span>}
            {!s.announce && <span className="text-[10px] uppercase text-muted">fora da agenda</span>}
          </div>
          <Link href={`/admin/shows/${s.id}`} className="font-display text-lg font-bold uppercase hover:text-gold">
            {s.venue}
          </Link>
          <div className="text-xs text-muted">
            {s.visitors} acessos · {s.requests} pedidos · 🎁 {s.promos} promoç{s.promos === 1 ? "ão" : "ões"} · 🛍️ {s.merch}{" "}
            {s.merch === 1 ? "item" : "itens"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.status === "live" ? (
            <>
              <Link href="/admin/ao-vivo" className="btn-hit px-3 py-1.5 text-sm">
                Painel ao vivo
              </Link>
              <form action={closeShow}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn-ghost px-3 py-1.5 text-sm">Encerrar</button>
              </form>
            </>
          ) : (
            <form action={publishShow}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn-gold px-3 py-1.5 text-sm">{s.status === "closed" ? "Reabrir" : "Publicar"}</button>
            </form>
          )}
          <Link href={`/admin/shows/${s.id}#loja`} className="btn-ghost px-3 py-1.5 text-sm">
            🛍️ Loja
          </Link>
          <Link href={`/admin/shows/${s.id}#promocoes`} className="btn-ghost px-3 py-1.5 text-sm">
            🎁 Promoções
          </Link>
          <Link href={`/admin/shows/${s.id}`} className="btn-ghost px-3 py-1.5 text-sm">
            Detalhes
          </Link>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-2 text-sm">
        <details className="group">
          <summary className="cursor-pointer text-muted hover:text-white">↻ Repetir em outra data</summary>
          <form action={duplicateShow} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={s.id} />
            <input type="date" name="show_date" required defaultValue={addDays(s.show_date, 7)} className="input w-auto py-1.5" />
            <button className="btn-gold px-3 py-1.5 text-sm">Repetir show</button>
            <span className="text-xs text-muted">Copia local, horário, limites, promoções e loja (como rascunho).</span>
          </form>
        </details>
        <form action={deleteShow} className="ml-auto">
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="back" value={back} />
          <ConfirmButton
            message={`Excluir o show "${s.venue}" de ${fmtDayMonth(s.show_date)}? Os pedidos, promoções e itens da loja dele também serão apagados.`}
            className="text-red-400 hover:underline"
          >
            Excluir show
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
