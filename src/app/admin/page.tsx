import Link from "next/link";
import { overallInsights } from "@/lib/insights";
import { Bars, PageTitle, Tile, fmtDate, pct } from "./ui";

export default async function Overview() {
  const { totals, topSongs, topArtists, perShow, neverRequested, topSuggestions } = await overallInsights();

  return (
    <div className="space-y-5">
      <PageTitle sub="Tudo o que aconteceu em todos os shows.">Visão geral</PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Shows" value={totals.shows} />
        <Tile
          label="Pessoas que acessaram"
          value={totals.visitors}
          hint={`${totals.requesters} fizeram pedidos (${pct(totals.requesters, totals.visitors)})`}
        />
        <Tile label="Pedidos" value={totals.requests} hint={`${totals.played} músicas tocadas a pedido`} />
        <Tile label="Recados / sugestões" value={`${totals.comments} / ${totals.suggestions}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars
          title="Músicas mais pedidas (todos os shows)"
          rows={topSongs.map((s) => ({
            label: s.label,
            sub: s.sub,
            value: s.value,
            extra: (
              <span className="shrink-0 text-[10px] text-muted">
                em {s.shows} show{s.shows > 1 ? "s" : ""}
              </span>
            ),
          }))}
        />
        <Bars title="Artistas mais pedidos" rows={topArtists} color="bg-gold" />
      </div>

      <section className="card overflow-x-auto">
        <h3 className="label px-4 pt-4">Comparativo por show</h3>
        {perShow.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Nenhum show publicado ainda.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Local</th>
                <th className="px-4 py-2 text-right">Acessos</th>
                <th className="px-4 py-2 text-right">Pediram</th>
                <th className="px-4 py-2 text-right">Pedidos</th>
                <th className="px-4 py-2 text-right">Tocadas</th>
                <th className="px-4 py-2">Mais pedida</th>
              </tr>
            </thead>
            <tbody>
              {perShow.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                  <td className="whitespace-nowrap px-4 py-2">{fmtDate(s.show_date)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/shows/${s.id}`} className="font-medium hover:text-gold">
                      {s.venue}
                    </Link>
                    {s.status === "live" && <span className="ml-2 rounded bg-hit px-1.5 text-[10px] font-bold">LIVE</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.visitors}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.requesters}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.requests}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.played}</td>
                  <td className="px-4 py-2 text-muted">{s.top_song ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars
          title="Sugestões mais repetidas (pendentes)"
          rows={topSuggestions.map((s) => ({ label: s.label, sub: s.sub, value: s.value }))}
          unit="sugestões"
          color="bg-gold"
          empty="Nenhuma sugestão pendente."
        />
        <section className="card p-4">
          <h3 className="label mb-1">Nunca pedidas ({neverRequested.length})</h3>
          <p className="mb-3 text-xs text-muted">
            Músicas ativas que ninguém pediu ainda. São candidatas a revisão, ou a entrar no set por conta da banda.
          </p>
          <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
            {neverRequested.map((s) => (
              <span key={s.title} className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-xs" title={s.artist_credit}>
                {s.title}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
