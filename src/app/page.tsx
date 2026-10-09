"use client";

import { useEffect, useState } from "react";

type Me = { email: string; name?: string } | null;

function base64ToUint8(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const [pushState, setPushState] = useState<"off" | "on" | "unsupported" | "denied">(() =>
    typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)
      ? "unsupported"
      : "off",
  );
  const [summaries, setSummaries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(async (r) => {
      setMe(r.ok ? await r.json() : null);
      setLoaded(true);
    });
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : Notification.permission === "denied" ? "denied" : "off");
      });
    }
  }, []);

  async function enablePush() {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState("denied");
      return;
    }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(key),
      });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setPushState("on");
  }

  async function summarizeNow() {
    setBusy(true);
    const r = await fetch("/api/summarize", { method: "POST" });
    const data = await r.json();
    setSummaries(data.summaries ?? []);
    setBusy(false);
  }

  if (!loaded) return <main className="flex flex-1 items-center justify-center text-sm text-zinc-400">Cargando…</main>;

  return (
    <main className="flex flex-1 flex-col items-center px-6 pt-20 pb-10 mx-auto w-full max-w-md">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center mb-6">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Mail Summary</h1>
      <p className="text-sm text-zinc-500 text-center mb-10">
        Resúmenes con IA de tus emails, directos a tus notificaciones.
      </p>

      {!me ? (
        <a
          href="/api/auth/google"
          className="w-full flex items-center justify-center gap-3 rounded-full border border-zinc-200 py-3 text-sm font-medium hover:bg-zinc-50 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2 3.6-5 3.6-8.6"/>
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5l-.14.01-3.7 2.9-.05.13C3.3 21.3 7.3 24 12 24"/>
            <path fill="#FBBC05" d="M5.2 14.4c-.25-.7-.4-1.5-.4-2.4s.15-1.7.42-2.4l-.01-.16L1.4 6.5l-.12.06A12 12 0 0 0 0 12c0 1.9.46 3.8 1.28 5.4l3.92-3"/>
            <path fill="#EB4335" d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.28 6.6l3.92 3c1-2.9 3.6-5 6.8-5"/>
          </svg>
          Continuar con Google
        </a>
      ) : (
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{me.name || me.email}</p>
              <p className="text-xs text-zinc-400 truncate">{me.email}</p>
            </div>
            <a href="/api/auth/logout" className="text-xs text-zinc-400 hover:text-zinc-600 shrink-0">Salir</a>
          </div>

          <button
            onClick={enablePush}
            disabled={pushState === "on" || pushState === "unsupported"}
            className="w-full rounded-full bg-zinc-900 text-white py-3 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 transition"
          >
            {pushState === "on" ? "Notificaciones activadas" : pushState === "unsupported" ? "Push no soportado en este navegador" : pushState === "denied" ? "Permiso denegado — actívalo en ajustes" : "Activar notificaciones"}
          </button>

          <button
            onClick={summarizeNow}
            disabled={busy}
            className="w-full rounded-full border border-zinc-200 py-3 text-sm font-medium hover:bg-zinc-50 transition disabled:opacity-40"
          >
            {busy ? "Resumiendo…" : "Resumir no leídos ahora"}
          </button>

          {summaries.length > 0 && (
            <ul className="w-full flex flex-col gap-2 mt-2">
              {summaries.map((s, i) => (
                <li key={i} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-300 text-center mt-auto pt-10">
        Instálala en tu móvil: Compartir → Añadir a pantalla de inicio.
      </p>
    </main>
  );
}
