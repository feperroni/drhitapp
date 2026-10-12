"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogArtist, CatalogSong } from "@/lib/catalog";

type State = {
  show: null | {
    id: number;
    venue: string;
    date: string;
    open: boolean;
    full: boolean;
    requestsPerPerson: number;
    windowMinutes: number;
  };
  mine?: { songId: number; title: string; credit: string; status: string; createdAt: string; position: number | null }[];
  queueSize?: number;
  unavailable?: { songId: number; status: string }[];
  nextAllowedAt?: string | null;
};

type Props = {
  bandName: string;
  instagram: string;
  pix: { payload: string; svg: string; key: string; name: string };
  catalog: { songs: CatalogSong[]; artists: CatalogArtist[]; medleys: number[] };
};

type Tab = "pedir" | "sugerir" | "pix" | "recado";

const MEDLEYS = "Medleys & Blocos Especiais";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Na fila", cls: "bg-gold/15 text-gold-soft border-gold/40" },
  accepted: { label: "Aceito pela banda", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  played: { label: "Já tocou! 🤘", cls: "bg-hit/15 text-red-300 border-hit/40" },
  rejected: { label: "Não vai rolar hoje", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40" },
};

export default function AudienceApp({ bandName, instagram, pix, catalog }: Props) {
  const [tab, setTab] = useState<Tab>("pedir");
  const [state, setState] = useState<State | null>(null);

  const refresh = useCallback(async (visit = false) => {
    const res = await fetch(`/api/public/state${visit ? "?visit=1" : ""}`, { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(), 15_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="relative overflow-hidden px-4 pb-4 pt-6 text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-64 rounded-full bg-hit/25 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt={`Logo ${bandName}`} className="relative mx-auto h-28 w-auto drop-shadow-[0_6px_24px_rgba(229,22,29,.35)]" />
        <h1 className="relative mt-3 font-display text-3xl font-bold uppercase tracking-wide">
          <span className="text-white">Doctor</span> <span className="text-hit">Hit</span>
        </h1>
        <a
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-1.5 text-sm text-white hover:border-gold"
        >
          <InstagramIcon /> @{instagram}
        </a>
        <ShowBanner state={state} />
      </header>

      <nav className="sticky top-0 z-20 border-y border-line bg-ink/90 px-2 backdrop-blur">
        <div className="grid grid-cols-4">
          {(
            [
              ["pedir", "🎵", "Pedir"],
              ["sugerir", "💡", "Sugerir"],
              ["pix", "💸", "Pix"],
              ["recado", "💬", "Recado"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                tab === id ? "text-gold" : "text-muted hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
              <span className={`mt-1 h-0.5 w-8 rounded-full ${tab === id ? "bg-gold" : "bg-transparent"}`} />
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-4 py-4">
        {tab === "pedir" && <RequestTab state={state} catalog={catalog} onDone={() => refresh()} />}
        {tab === "sugerir" && <SuggestTab />}
        {tab === "pix" && <PixTab pix={pix} />}
        {tab === "recado" && <CommentTab />}
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted">
        {bandName} · Obrigado por curtir o show! 🤘
      </footer>
    </div>
  );
}

function ShowBanner({ state }: { state: State | null }) {
  if (!state) return <div className="mt-4 h-14" />;
  if (!state.show)
    return (
      <div className="relative mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
        Nenhum show ao vivo agora. Você pode ver o repertório, sugerir músicas e mandar um recado!
      </div>
    );
  return (
    <div className="relative mt-4 rounded-2xl border border-hit/50 bg-gradient-to-r from-hit/20 to-transparent px-4 py-3 text-left">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-hit" /> Ao vivo
      </div>
      <div className="font-display text-xl font-bold uppercase">{state.show.venue}</div>
      <div className="text-sm text-muted first-letter:uppercase">{fmtDate(state.show.date)}</div>
    </div>
  );
}

function RequestTab({
  state,
  catalog,
  onDone,
}: {
  state: State | null;
  catalog: Props["catalog"];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [artist, setArtist] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CatalogSong | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const songsById = useMemo(() => new Map(catalog.songs.map((s) => [s.id, s])), [catalog.songs]);
  const unavailable = useMemo(
    () => new Map((state?.unavailable ?? []).map((u) => [u.songId, u.status])),
    [state?.unavailable],
  );

  const groups = useMemo(() => {
    const list = catalog.artists.map((a) => ({ name: a.name, songIds: a.songIds }));
    if (catalog.medleys.length) list.unshift({ name: MEDLEYS, songIds: catalog.medleys });
    return list;
  }, [catalog]);

  const q = normalize(query.trim());
  const filteredArtists = q ? groups.filter((g) => normalize(g.name).includes(q)) : groups;
  const filteredSongs = q
    ? catalog.songs.filter((s) => normalize(s.title).includes(q) || normalize(s.credit).includes(q) || normalize(s.medley ?? "").includes(q))
    : [];

  const current = artist ? groups.find((g) => g.name === artist) : null;
  const canRequest = !!state?.show?.open && !state.nextAllowedAt;

  async function send(song: CatalogSong) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/public/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: song.id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (res.ok) {
      setMsg({ ok: true, text: `Pedido enviado: “${song.title}”. A banda já foi avisada! 🎸` });
      setArtist(null);
      setQuery("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setMsg({ ok: false, text: data.error ?? "Não foi possível enviar o pedido." });
    }
    onDone();
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-hit/40 bg-hit/10 text-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <MyRequests state={state} />
      <RequestRules state={state} />

      {current ? (
        <div>
          <button onClick={() => setArtist(null)} className="mb-3 text-sm text-muted hover:text-white">
            ← Todos os artistas
          </button>
          <h2 className="mb-3 font-display text-2xl font-bold uppercase text-gold">{current.name}</h2>
          <SongList
            songs={current.songIds.map((id) => songsById.get(id)!).filter(Boolean)}
            unavailable={unavailable}
            canRequest={canRequest}
            onPick={setConfirm}
          />
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              className="input pl-10"
              placeholder="Busque artista ou música…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">🔎</span>
          </div>

          {filteredSongs.length > 0 && (
            <section>
              <h3 className="label">Músicas</h3>
              <SongList songs={filteredSongs} unavailable={unavailable} canRequest={canRequest} onPick={setConfirm} />
            </section>
          )}

          <section>
            <h3 className="label">Escolha o artista ({filteredArtists.length})</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredArtists.map((g) => (
                <li key={g.name}>
                  <button
                    onClick={() => {
                      setArtist(g.name);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition hover:border-gold ${
                      g.name === MEDLEYS ? "border-gold/40 bg-gold/10" : "border-line bg-panel"
                    }`}
                  >
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-xs text-muted">
                      {g.songIds.length} {g.songIds.length === 1 ? "música" : "músicas"} ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {filteredArtists.length === 0 && filteredSongs.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                Nada encontrado. Que tal sugerir essa música na aba <b>Sugerir</b>?
              </p>
            )}
          </section>
        </>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => !busy && setConfirm(null)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="label">Confirmar pedido</div>
            <div className="font-display text-2xl font-bold">{confirm.title}</div>
            <div className="text-muted">{confirm.credit}</div>
            {confirm.medley && <p className="mt-2 text-sm text-muted">{confirm.medley}</p>}
            {state?.show && (
              <p className="mt-3 text-xs text-muted">
                Você pode fazer {state.show.requestsPerPerson} pedido{state.show.requestsPerPerson > 1 ? "s" : ""} a cada{" "}
                {state.show.windowMinutes} min.
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button className="btn-hit" disabled={busy} onClick={() => send(confirm)}>
                {busy ? "Enviando…" : "Pedir 🎵"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRules({ state }: { state: State | null }) {
  if (!state?.show) return null;
  let text: string | null = null;
  if (state.show.full) text = "O limite de pedidos deste show foi atingido. Obrigado pela participação!";
  else if (!state.show.open) text = "Os pedidos estão pausados pela banda no momento.";
  else if (state.nextAllowedAt) text = `Você poderá fazer um novo pedido às ${fmtTime(state.nextAllowedAt)}.`;
  if (!text) return null;
  return <div className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm text-muted">{text}</div>;
}

function MyRequests({ state }: { state: State | null }) {
  const mine = state?.mine ?? [];
  if (!mine.length) return null;
  return (
    <section className="card p-4">
      <h3 className="label">Seus pedidos</h3>
      <ul className="space-y-3">
        {mine.map((m) => {
          const st = STATUS[m.status] ?? STATUS.pending;
          return (
            <li key={m.songId + m.createdAt} className="flex items-center gap-3">
              {m.position ? (
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gold text-black">
                  <span className="font-display text-xl font-bold leading-none">{m.position}º</span>
                  <span className="text-[9px] font-bold uppercase">na fila</span>
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel-2 text-xl">
                  {m.status === "played" ? "🤘" : "🎵"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{m.title}</div>
                <div className="truncate text-xs text-muted">
                  {m.credit} · pedido às {fmtTime(m.createdAt)}
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
            </li>
          );
        })}
      </ul>
      {mine.some((m) => m.position) && (
        <p className="mt-3 text-xs text-muted">A posição mostra a ordem do seu pedido em relação aos outros pedidos em aberto.</p>
      )}
    </section>
  );
}

function SongList({
  songs,
  unavailable,
  canRequest,
  onPick,
}: {
  songs: CatalogSong[];
  unavailable: Map<number, string>;
  canRequest: boolean;
  onPick: (s: CatalogSong) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
      {songs.map((s) => {
        const u = unavailable.get(s.id);
        return (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs text-muted">{s.medley ?? s.credit}</div>
            </div>
            {u ? (
              <span className="shrink-0 text-xs text-muted">{u === "played" ? "Já tocou hoje" : "Indisponível"}</span>
            ) : (
              <button className="btn-hit shrink-0 px-3 py-1.5 text-sm" disabled={!canRequest} onClick={() => onPick(s)}>
                Pedir
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useForm(url: string) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(body: object, okText: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: data.error ?? "Algo deu errado. Tente de novo." });
    return res.ok;
  }
  return { busy, msg, submit };
}

function FormMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>;
}

function SuggestTab() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const { busy, msg, submit } = useForm("/api/public/suggestion");
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await submit({ title, artist }, "Valeu pela sugestão! A banda vai dar uma olhada. 🎶")) {
          setTitle("");
          setArtist("");
        }
      }}
    >
      <div>
        <h2 className="font-display text-2xl font-bold uppercase">Sugira uma música</h2>
        <p className="text-sm text-muted">Qual música você gostaria de ver no repertório dos próximos shows?</p>
      </div>
      <div>
        <label className="label">Música</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Primeiros Erros" maxLength={120} required />
      </div>
      <div>
        <label className="label">Artista / banda</label>
        <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ex.: Capital Inicial" maxLength={120} />
      </div>
      <FormMsg msg={msg} />
      <button className="btn-gold w-full" disabled={busy}>
        {busy ? "Enviando…" : "Enviar sugestão"}
      </button>
    </form>
  );
}

function CommentTab() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const { busy, msg, submit } = useForm("/api/public/comment");
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await submit({ name, message }, "Recado enviado! Obrigado pelo carinho. ❤️")) setMessage("");
      }}
    >
      <div>
        <h2 className="font-display text-2xl font-bold uppercase">Mande um recado</h2>
        <p className="text-sm text-muted">Curtiu o show? Tem um feedback? Fala com a gente!</p>
      </div>
      <div>
        <label className="label">Seu nome (opcional)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <div>
        <label className="label">Mensagem</label>
        <textarea className="input min-h-32" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} required />
      </div>
      <FormMsg msg={msg} />
      <button className="btn-gold w-full" disabled={busy}>
        {busy ? "Enviando…" : "Enviar recado"}
      </button>
    </form>
  );
}

function PixTab({ pix }: { pix: Props["pix"] }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {}
  }
  return (
    <div className="card space-y-4 p-5 text-center">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase">Apoie a banda 💛</h2>
        <p className="text-sm text-muted">Qualquer valor ajuda! Escaneie o QR no app do seu banco ou copie o código Pix.</p>
      </div>
      <div className="mx-auto w-56 rounded-2xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: pix.svg }} />
      <div className="text-sm">
        <div className="text-muted">Favorecido</div>
        <div className="font-semibold">{pix.name}</div>
        <div className="mt-2 text-muted">Chave Pix (e-mail)</div>
        <div className="font-semibold break-all">{pix.key}</div>
      </div>
      <div className="grid gap-2">
        <button className="btn-gold w-full" onClick={() => copy(pix.payload, "code")}>
          {copied === "code" ? "Copiado! ✓" : "Copiar Pix Copia e Cola"}
        </button>
        <button className="btn-ghost w-full" onClick={() => copy(pix.key, "key")}>
          {copied === "key" ? "Chave copiada! ✓" : "Copiar só a chave"}
        </button>
      </div>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
