"use client";
import Script from "next/script";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { createShojinClient } from "@/lib/client/shojinClient";

type Client = ReturnType<typeof createShojinClient>;
type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
/** checking: sign-in still running · failed: it went wrong · unavailable: Supabase or Turnstile not set up */
export type AuthStatus = "checking" | "signed_in" | "failed" | "unavailable";
type Ctx = { client: Client; userId: string | null; status: AuthStatus; whenReady: () => Promise<void> };

export const READY_WAIT_MS = 10_000; // a scan waits at most this long for sign-in, then goes on unsaved
const TOKEN_WAIT_MS = 30_000; // give up on Turnstile after this (it may need a tap)

const ShojinCtx = createContext<Ctx | null>(null);

// The one Shojin client for the screens, plus anonymous sign-in (spec 13.1), done the way /dev does it:
// an existing session is reused; only without one does Turnstile load and a new anonymous user get
// created. Scans wait for this (whenReady, at most READY_WAIT_MS) so they are saved; if it fails,
// scanning still works without a scanId.
export function ShojinProvider({ supabaseUrl, supabaseAnonKey, turnstileSiteKey, children }: {
  supabaseUrl: string | null; supabaseAnonKey: string | null; turnstileSiteKey: string | null; children: ReactNode;
}) {
  const supabase = useMemo(
    () => (supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null),
    [supabaseUrl, supabaseAnonKey],
  );
  const client = useMemo(() => createShojinClient({ supabase }), [supabase]);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const ready = useRef<Promise<unknown> | null>(null);

  // Asked for only when there is no session: shows the (invisible) widget and waits for its token.
  const getCaptchaToken = useCallback(() => new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Turnstile timed out")), TOKEN_WAIT_MS);
    const done = () => { clearTimeout(timer); token.current = null; setNeedCaptcha(false); };
    token.current = {
      resolve: (t) => { done(); resolve(t); },
      reject: (e) => { done(); reject(e); },
    };
    setNeedCaptcha(true);
  }), []);

  useEffect(() => {
    let live = true;
    const run = client.ensureSession(turnstileSiteKey ? getCaptchaToken : undefined).then((r) => {
      if (!live) return;
      setUserId(r.userId ?? null);
      setStatus(r.ok ? "signed_in" : !supabase || !turnstileSiteKey ? "unavailable" : "failed");
    });
    ready.current = run;
    return () => { live = false; };
  }, [client, supabase, turnstileSiteKey, getCaptchaToken]);

  const whenReady = useCallback(async () => {
    await Promise.race([ready.current ?? Promise.resolve(), new Promise((r) => setTimeout(r, READY_WAIT_MS))]);
  }, []);

  function renderWidget() {
    const ts = (window as unknown as { turnstile?: Turnstile }).turnstile;
    if (!ts || !widget.current || widgetId.current) return;
    const finish = () => { if (widgetId.current) ts.remove(widgetId.current); widgetId.current = null; };
    widgetId.current = ts.render(widget.current, {
      sitekey: turnstileSiteKey,
      appearance: "interaction-only", // invisible unless Cloudflare needs the visitor to tap
      callback: (t: string) => { finish(); token.current?.resolve(t); },
      "error-callback": () => { finish(); token.current?.reject(new Error("Turnstile error")); },
      "timeout-callback": () => { finish(); token.current?.reject(new Error("Turnstile challenge timed out")); },
      "expired-callback": () => { finish(); token.current?.reject(new Error("Turnstile token expired")); },
    });
  }

  return (
    <ShojinCtx.Provider value={{ client, userId, status, whenReady }}>
      {children}
      {needCaptcha && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderWidget}
            onError={() => token.current?.reject(new Error("Turnstile script failed to load"))} />
          <div ref={widget} className="fixed bottom-4 left-4 z-[80]" />
        </>
      )}
    </ShojinCtx.Provider>
  );
}

export function useShojin() {
  const c = useContext(ShojinCtx);
  if (!c) throw new Error("useShojin must be used inside <ShojinProvider>");
  return c;
}
