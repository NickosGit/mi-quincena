"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next = "/dashboard" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="min-h-14 rounded-2xl bg-ink px-5 text-lg font-bold text-white disabled:opacity-60"
      >
        {busy ? "Abriendo Google…" : "Entrar con Google"}
      </button>
      {failed && (
        <p role="alert" className="text-base text-ink">
          No pudimos abrir Google. Intenta otra vez en un momento.
        </p>
      )}
    </div>
  );
}
