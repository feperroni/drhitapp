import Link from "next/link";
import { sql } from "@/lib/db";
import { setSuggestionStatus } from "../actions";
import { PageTitle, fmtDateTime } from "../ui";

type Row = { id: number; title: string; artist: string | null; status: string; created_at: string; venue: string | null };

export default async function SugestoesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status ?? "new";
  const rows = await sql<Row[]>`
    select s.id, s.title, s.artist, s.status, s.created_at, sh.venue
    from suggestions s left join shows sh on sh.id = s.show_id
    where s.status = ${status}
    order by s.created_at desc limit 300`;

  const tabs = [
    ["new", "Novas"],
    ["added", "Adicionadas"],
    ["dismissed", "Descartadas"],
  ];

  return (
    <div className="space-y-5">
      <PageTitle sub="Músicas que a plateia gostaria de ver no repertório.">Sugestões</PageTitle>
      <div className="flex gap-2">
        {tabs.map(([id, label]) => (
          <Link key={id} href={`/admin/sugestoes?status=${id}`} className={`btn text-sm ${status === id ? "bg-gold text-black" : "btn-ghost"}`}>
            {label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">Nada por aqui.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {s.title} {s.artist && <span className="font-normal text-muted">— {s.artist}</span>}
                </div>
                <div className="text-xs text-muted">
                  {fmtDateTime(s.created_at)}
                  {s.venue ? ` · durante o show em ${s.venue}` : ""}
                </div>
              </div>
              {s.status === "new" && (
                <div className="flex gap-2">
                  <Link
                    href={`/admin/repertorio?title=${encodeURIComponent(s.title)}&artist=${encodeURIComponent(s.artist ?? "")}&suggestion=${s.id}#form`}
                    className="btn-gold px-3 py-1.5 text-sm"
                  >
                    + Repertório
                  </Link>
                  <form action={setSuggestionStatus}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button className="btn-ghost px-3 py-1.5 text-sm">Descartar</button>
                  </form>
                </div>
              )}
              {s.status !== "new" && (
                <form action={setSuggestionStatus}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="status" value="new" />
                  <button className="text-sm text-muted hover:text-white">Voltar para novas</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
