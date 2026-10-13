// Datas como texto "AAAA-MM-DD" (sem fuso), para navegar semana a semana e mês a mês.

function toUTC(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function isDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toUTC(d).getTime());
}

export function isMonth(m: unknown): m is string {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function todaySP() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function addDays(d: string, n: number) {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

/** Segunda-feira da semana da data. */
export function mondayOf(d: string) {
  const dow = toUTC(d).getUTCDay(); // 0 = domingo
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

export function monthOf(d: string) {
  return d.slice(0, 7);
}

export function addMonths(m: string, n: number) {
  const [y, mm] = m.split("-").map(Number);
  const x = new Date(Date.UTC(y, mm - 1 + n, 1));
  return fromUTC(x).slice(0, 7);
}

export function monthRange(m: string): [string, string] {
  const first = `${m}-01`;
  const last = addDays(`${addMonths(m, 1)}-01`, -1);
  return [first, last];
}

export function fmtDayMonth(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

export function fmtWeekday(d: string, style: "short" | "long" = "short") {
  return toUTC(d).toLocaleDateString("pt-BR", { weekday: style, timeZone: "UTC" }).replace(".", "");
}

export function fmtMonth(m: string) {
  const s = toUTC(`${m}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
