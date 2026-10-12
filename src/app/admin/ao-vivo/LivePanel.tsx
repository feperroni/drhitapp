"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DoneItem, QueueItem, Show } from "@/lib/shows";

type Live = {
  show: Show | null;
  queue?: QueueItem[];
  done?: DoneItem[];
  total?: number;
  stats?: { visitors: number; requesters: number; comments: number };
};

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.2);
    });
  } catch {}
}

export default function LivePanel({ vapidKey }: { vapidKey: string }) {
  const [data, setData] = useState<Live | null>(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/live", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource("/api/admin/stream");
      es.onopen = () => {
        setConnected(true);
        load();
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 3000);
      };
      es.onmessage = (m) => {
        const e = JSON.parse(m.data);
        if (e.type === "request") {
          setToast(`🎵 ${e.title} — ${e.credit}`);
          setFlash(e.songId);
          setTimeout(() => setFlash(null), 4000);
          setTimeout(() => setToast(null), 6000);
          if (soundRef.current) beep();
          if ("vibrate" in navigator) navigator.vibrate?.(200);
        }
        if (["request", "queue", "show", "comment"].includes(e.type)) load();
      };
    };
    connect();
    const poll = setInterval(load, 30_000); // rede de segurança caso o SSE caia
    return () => {
      es?.close();
      clearTimeout(retry);
      clearInterval(poll);
    };
  }, [load]);

  async function act(songId: number, action: "accept" | "played" | "reject" | "reopen") {
    if (!data?.show) return;
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: data.show.id, songId, action }),
    });
    load();
  }

  async function config(patch: Record<string, unknown>) {
    if (!data?.show) return;
    await fetch("/api/admin/show-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: data.show.id, ...patch }),
    });
    load();
  }

  if (!data) return <p className="text-muted">Carregando…</p>;

  if (!data.show)
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <div className="text-5xl">🎤</div>
        <h1 className="font-display text-3xl font-bold uppercase">Nenhum show ao vivo</h1>
        <p className="text-muted">Cadastre e publique o show de hoje para começar a receber pedidos.</p>
        <Link href="/admin/shows" className="btn-hit">
          Ir para Shows
        </Link>
        <div className="pt-6">
          <PushSetup vapidKey={vapidKey} />
        </div>
      </div>
    );

  const { show, queue = [], done = [], total = 0, stats } = data;
  const pending = queue.filter((q) => q.status === "pending").length;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md animate-bounce rounded-2xl border border-gold bg-black/90 px-4 py-3 text-center font-semibold shadow-2xl shadow-gold/20">
          Novo pedido! {toast}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-hit" /> Ao vivo
            <span className={`ml-2 font-normal normal-case tracking-normal ${connected ? "text-emerald-400" : "text-muted"}`}>
              {connected ? "● conectado" : "○ reconectando…"}
            </span>
          </div>
          <h1 className="truncate font-display text-3xl font-bold uppercase">{show.venue}</h1>
          <div className="text-sm text-muted">{show.show_date.split("-").reverse().join("/")}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-sm" onClick={() => setSound((s) => !s)}>
            {sound ? "🔔 Som ligado" : "🔕 Som desligado"}
          </button>
          <WakeLockButton />
          <Link href={`/admin/shows/${show.id}`} className="btn-ghost text-sm">
            📊 Insights
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Na fila" value={queue.length} hint={`${pending} aguardando`} />
        <Stat label="Pedidos" value={total} hint={show.max_requests ? `limite ${show.max_requests}` : "sem limite"} />
        <Stat label="Acessos" value={stats?.visitors ?? 0} hint={`${stats?.requesters ?? 0} pediram`} />
        <Stat label="Tocadas" value={done.filter((d) => d.status === "played").length} hint={`${stats?.comments ?? 0} recados`} />
      </div>

      <ShowControls show={show} onChange={config} />

      <section>
        <h2 className="label">Fila de pedidos</h2>
        {queue.length === 0 ? (
          <div className="card px-4 py-10 text-center text-muted">Nenhum pedido em aberto. Assim que alguém pedir, aparece aqui. 🎸</div>
        ) : (
          <ol className="space-y-2">
            {queue.map((q, i) => (
              <li
                key={q.song_id}
                className={`card flex flex-wrap items-center gap-3 p-3 transition sm:flex-nowrap ${
                  flash === q.song_id ? "border-gold ring-2 ring-gold/50" : ""
                } ${q.status === "accepted" ? "border-emerald-500/40" : ""}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel-2 font-display text-2xl font-bold">
                  {i + 1}
                </div>
                <div className="min-w-[12rem] flex-1">
                  <div className="text-lg font-semibold leading-tight">{q.title}</div>
                  <div className="truncate text-sm text-muted">
                    {q.artist_credit} · {ago(q.first_at)}
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                  {q.votes > 1 && (
                    <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-black">×{q.votes} pedidos</span>
                  )}
                  {q.status === "accepted" ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      Aceita
                    </span>
                  ) : (
                    <button className="btn bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500" onClick={() => act(q.song_id, "accept")}>
                      ✓ Aceitar
                    </button>
                  )}
                  <button className="btn-hit px-3 py-2 text-sm" onClick={() => act(q.song_id, "played")}>
                    🤘 Tocada
                  </button>
                  <button className="btn-ghost px-3 py-2 text-sm" title="Recusar" onClick={() => act(q.song_id, "reject")}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <button className="label flex items-center gap-1 hover:text-white" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "▾" : "▸"} Já tocadas / recusadas ({done.length})
          </button>
          {showDone && (
            <ul className="card divide-y divide-line">
              {done.map((d) => (
                <li key={d.song_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span>{d.status === "played" ? "🤘" : "✕"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="truncate text-xs text-muted">
                      {d.artist_credit} · {d.votes} pedido{d.votes > 1 ? "s" : ""} · {d.status === "played" ? "tocada" : "recusada"} {ago(d.updated_at)}
                    </div>
                  </div>
                  <button className="text-xs text-muted hover:text-white" onClick={() => act(d.song_id, "reopen")}>
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <PushSetup vapidKey={vapidKey} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

function ShowControls({ show, onChange }: { show: Show; onChange: (p: Record<string, unknown>) => void }) {
  const [edit, setEdit] = useState(false);
  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <button
        onClick={() => onChange({ requestsOpen: !show.requests_open })}
        className={`btn text-sm ${show.requests_open ? "bg-emerald-600 text-white" : "bg-zinc-700 text-white"}`}
      >
        {show.requests_open ? "● Pedidos abertos" : "○ Pedidos pausados"}
      </button>
      <div className="text-sm text-muted">
        {show.requests_per_person} pedido{show.requests_per_person > 1 ? "s" : ""} por pessoa a cada {show.window_minutes} min ·{" "}
        {show.max_requests ? `máx. ${show.max_requests} no show` : "sem limite total"}
      </div>
      <button className="ml-auto text-sm text-gold hover:underline" onClick={() => setEdit((v) => !v)}>
        {edit ? "Fechar" : "Ajustar limites"}
      </button>
      {edit && (
        <form
          className="grid w-full grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onChange({
              requestsPerPerson: fd.get("rpp"),
              windowMinutes: fd.get("win"),
              maxRequests: fd.get("max") || null,
            });
            setEdit(false);
          }}
        >
          <label>
            <span className="label">Pedidos por pessoa</span>
            <input name="rpp" type="number" min={1} defaultValue={show.requests_per_person} className="input" />
          </label>
          <label>
            <span className="label">A cada (minutos)</span>
            <input name="win" type="number" min={1} defaultValue={show.window_minutes} className="input" />
          </label>
          <label>
            <span className="label">Limite total do show</span>
            <input name="max" type="number" min={1} defaultValue={show.max_requests ?? ""} placeholder="sem limite" className="input" />
          </label>
          <button className="btn-gold self-end">Salvar</button>
        </form>
      )}
    </div>
  );
}

function WakeLockButton() {
  const [lock, setLock] = useState<WakeLockSentinel | null>(null);
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return null;
  return (
    <button
      className="btn-ghost text-sm"
      onClick={async () => {
        if (lock) {
          await lock.release();
          setLock(null);
        } else {
          try {
            const l = await navigator.wakeLock.request("screen");
            l.addEventListener("release", () => setLock(null));
            setLock(l);
          } catch {}
        }
      }}
    >
      {lock ? "☀️ Tela sempre acesa" : "🌙 Manter tela acesa"}
    </button>
  );
}

function PushSetup({ vapidKey }: { vapidKey: string }) {
  const [status, setStatus] = useState<"unsupported" | "off" | "on" | "denied" | "loading" | "ios">("loading");

  useEffect(() => {
    (async () => {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(isIOS && !standalone ? "ios" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setStatus("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setStatus(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) }));
      await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), label: navigator.userAgent.slice(0, 120), test: true }),
      });
      setStatus("on");
    } catch (e) {
      console.error(e);
      setStatus("off");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/admin/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setStatus("off");
  }

  return (
    <div className="card p-4 text-left">
      <div className="label">Notificações neste aparelho</div>
      {status === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-emerald-300">✓ Ativadas: você recebe um alerta a cada novo pedido.</span>
          <button className="text-sm text-muted hover:text-white" onClick={disable}>
            Desativar
          </button>
        </div>
      )}
      {status === "off" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Receba um alerta no celular/tablet quando chegar um pedido, mesmo com a tela bloqueada.</span>
          <button className="btn-gold text-sm" onClick={enable}>
            🔔 Ativar notificações
          </button>
        </div>
      )}
      {status === "denied" && <p className="text-sm text-red-300">Notificações bloqueadas no navegador. Libere nas configurações do site.</p>}
      {status === "ios" && (
        <p className="text-sm text-muted">
          No iPhone/iPad: toque em <b>Compartilhar → Adicionar à Tela de Início</b>, abra o app pelo ícone e ative as notificações aqui.
        </p>
      )}
      {status === "unsupported" && <p className="text-sm text-muted">Este navegador não suporta notificações push.</p>}
      {status === "loading" && <p className="text-sm text-muted">Verificando…</p>}
    </div>
  );
}
