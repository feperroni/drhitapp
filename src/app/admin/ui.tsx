// Componentes simples da console (servidor): números de destaque e barras horizontais.

export function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Bars({
  title,
  rows,
  unit = "pedidos",
  empty = "Sem dados ainda.",
  color = "bg-hit",
}: {
  title: string;
  rows: { label: string; sub?: string | null; value: number; extra?: React.ReactNode }[];
  unit?: string;
  empty?: string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-4">
      <h3 className="label mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.label + i} title={`${r.label}${r.sub ? ` — ${r.sub}` : ""}: ${r.value} ${unit}`} className="group">
              <div className="mb-1 flex items-baseline gap-2 text-sm">
                <span className="truncate font-medium">{r.label}</span>
                {r.sub && <span className="truncate text-xs text-muted">{r.sub}</span>}
                {r.extra}
                <span className="ml-auto shrink-0 tabular-nums text-muted group-hover:text-white">{r.value}</span>
              </div>
              <div className="h-2 rounded-full bg-panel-2">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Barras verticais por horário (pedidos a cada 15 min). */
export function Timeline({ rows }: { rows: { bucket: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const peak = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0] ?? { bucket: "", value: 0 });
  return (
    <section className="card p-4">
      <h3 className="label mb-1">Pedidos ao longo do show (a cada 15 min)</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted">Sem pedidos ainda.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            Pico às <b className="text-white">{peak.bucket}</b> com {peak.value} pedido{peak.value > 1 ? "s" : ""}.
          </p>
          <div className="flex h-36 items-end gap-1 border-b border-line pt-6">
            {rows.map((r) => (
              <div key={r.bucket} className="group relative flex h-full flex-1 items-end" title={`${r.bucket}: ${r.value} pedidos`}>
                <div className="w-full rounded-t-[4px] bg-gold group-hover:bg-gold-soft" style={{ height: `${(r.value / max) * 100}%` }} />
                <span className="pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 rounded bg-black px-1.5 py-0.5 text-xs group-hover:block">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-[10px] text-muted">
            {rows.map((r, i) => (
              <span key={r.bucket} className="flex-1 text-center">
                {rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0 ? r.bucket : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-bold uppercase">{children}</h1>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "21:00:00", "01:30:00" → "21h às 01h30" */
export function fmtTimeRange(start: string | null, end: string | null) {
  const f = (t: string) => {
    const [h, m] = t.split(":");
    return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
  };
  if (start && end) return `${f(start)} às ${f(end)}`;
  if (start) return `a partir das ${f(start)}`;
  if (end) return `até ${f(end)}`;
  return "";
}

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "—";
}
