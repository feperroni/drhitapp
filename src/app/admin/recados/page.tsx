import { sql } from "@/lib/db";
import { markCommentsRead } from "../actions";
import { PageTitle, fmtDateTime } from "../ui";

type Row = { id: number; name: string | null; message: string; read: boolean; created_at: string; venue: string | null };

export default async function RecadosPage() {
  const rows = await sql<Row[]>`
    select c.id, c.name, c.message, c.read, c.created_at, sh.venue
    from comments c left join shows sh on sh.id = c.show_id
    order by c.created_at desc limit 300`;
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="space-y-5">
      <PageTitle sub="Comentários e feedbacks enviados pela plateia.">Recados</PageTitle>
      {unread > 0 && (
        <form action={markCommentsRead}>
          <button className="btn-ghost text-sm">Marcar todos como lidos ({unread})</button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="text-muted">Nenhum recado ainda.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id} className={`card p-4 ${c.read ? "" : "border-gold/60"}`}>
              <p className="whitespace-pre-wrap">{c.message}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span>
                  {c.name ?? "Anônimo"} · {fmtDateTime(c.created_at)}
                  {c.venue ? ` · ${c.venue}` : ""}
                </span>
                <form action={markCommentsRead} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="hover:text-white">{c.read ? "Marcar como não lido" : "Marcar como lido"}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
