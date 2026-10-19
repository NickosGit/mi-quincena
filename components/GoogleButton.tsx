"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    // No query string: Supabase matches redirect URLs exactly for hosts other than
    // the Site URL, so "/auth/callback?next=…" was rejected on localhost. The
    // callback lands on /dashboard by default.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
