"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Deletes every installment of the signed-in user (RLS limits it to their rows). */
export function DeleteAll() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setStep("busy");
    setError(null);
    // PostgREST refuses an unfiltered DELETE; "id is not null" matches every own row.
    const { error } = await createClient().from("installments").delete().not("id", "is", null);
    if (error) {
      setError("No pudimos borrar tus datos. Intenta otra vez.");
      setStep("confirm");
      return;
    }
    setStep("idle");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      {step === "idle" ? (
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="min-h-12 rounded-xl border border-line bg-card px-4 text-base font-semibold"
        >
          Borrar todos mis datos
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4" role="alertdialog" aria-labelledby="delete-q">
          <p id="delete-q" className="text-lg font-semibold">
            ¿Borrar todos tus pagos guardados? No se puede deshacer.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep("idle")}
              disabled={step === "busy"}
              className="min-h-12 rounded-xl border border-line px-4 text-base font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={step === "busy"}
              className="min-h-12 rounded-xl bg-ink px-4 text-base font-bold text-white disabled:opacity-60"
            >
              {step === "busy" ? "Borrando…" : "Sí, borrar todo"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-base text-ink">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
