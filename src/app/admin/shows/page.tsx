import Link from "next/link";
import { sql } from "@/lib/db";
import type { Show } from "@/lib/shows";
import { closeShow, createShow, publishShow } from "../actions";
import { PageTitle, fmtDate, fmtTimeRange } from "../ui";

const STATUS = {
  draft: { label: "Rascunho", cls: "bg-zinc-700 text-zinc-200" },
  live: { label: "Ao vivo", cls: "bg-hit text-white" },
  closed: { label: "Encerrado", cls: "bg-panel-2 text-muted border border-line" },
};

export default async function ShowsPage() {
  const shows = await sql<(Show & { requests: number; visitors: number; promos: number })[]>`
    select sh.*,
      (select count(*) from song_requests r where r.show_id = sh.id)::int as requests,
      (select count(distinct device_id) from visits v where v.show_id = sh.id)::int as visitors,
      (select count(*) from promotions p where p.show_id = sh.id and p.active)::int as promos
    from shows sh order by sh.show_date desc, sh.id desc`;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="space-y-6">
      <PageTitle sub="Cadastre o show e publique: a partir daí, todos os pedidos vão para ele.">Shows</PageTitle>

      <form action={createShow} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <h2 className="label sm:col-span-2 lg:col-span-6">Novo show</h2>
        <label className="lg:col-span-1">
          <span className="label">Data</span>
          <input type="date" name="show_date" defaultValue={today} required className="input" />
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
            rows={3}
            className="input"
            placeholder={"Chopp em dobro — Mostre esta tela no bar e ganhe 2 chopps pelo preço de 1 até 23h\nPorção de fritas — 20% de desconto para quem mostrar o app"}
          />
          <span className="mt-1 block text-xs text-muted">
            Use “Título — descrição”. Você pode adicionar, pausar ou remover promoções depois, na página do show.
          </span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
          <button name="publish" value="1" className="btn-hit">
            Salvar e publicar agora
          </button>
          <button className="btn-ghost">Salvar como rascunho</button>
        </div>
      </form>

      <section className="space-y-2">
        {shows.length === 0 && <p className="text-muted">Nenhum show cadastrado ainda.</p>}
        {shows.map((s) => (
          <div key={s.id} className={`card flex flex-wrap items-center gap-3 p-4 ${s.status === "live" ? "border-hit/60" : ""}`}>
            <div className="min-w-[14rem] flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                <span className="text-sm text-muted">
                  {fmtDate(s.show_date)}
                  {fmtTimeRange(s.start_time, s.end_time) && ` · ${fmtTimeRange(s.start_time, s.end_time)}`}
                </span>
                {!s.announce && <span className="text-[10px] uppercase text-muted">fora da agenda</span>}
              </div>
              <Link href={`/admin/shows/${s.id}`} className="font-display text-xl font-bold uppercase hover:text-gold">
                {s.venue}
              </Link>
              <div className="text-xs text-muted">
                {s.visitors} acessos · {s.requests} pedidos · {s.requests_per_person} pedido(s)/pessoa a cada {s.window_minutes} min
                {s.max_requests ? ` · limite ${s.max_requests}` : ""}
                {s.promos ? ` · 🎁 ${s.promos} promoç${s.promos > 1 ? "ões" : "ão"}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.status === "live" && (
                <>
                  <Link href="/admin/ao-vivo" className="btn-hit text-sm">
                    Abrir painel ao vivo
                  </Link>
                  <form action={closeShow}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-ghost text-sm">Encerrar</button>
                  </form>
                </>
              )}
              {s.status !== "live" && (
                <form action={publishShow}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn-gold text-sm">{s.status === "closed" ? "Reabrir" : "Publicar"}</button>
                </form>
              )}
              <Link href={`/admin/shows/${s.id}`} className="btn-ghost text-sm">
                Detalhes e insights
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
