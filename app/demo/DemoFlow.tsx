"use client";

import { useState } from "react";

import { GoogleButton } from "@/components/GoogleButton";
import { PrePurchase } from "@/components/PrePurchase";
import { QuincenaCards } from "@/components/QuincenaCards";
import { ScanFlow } from "@/components/ScanFlow";
import { upcomingCards, type SavedInstallment } from "@/lib/review";
import { todayInMexico } from "@/lib/today";

const SAMPLES = [
  { file: "clean.png", label: "Captura de ejemplo" },
  { file: "blurred.png", label: "Foto borrosa de ejemplo" },
];

/** The whole flow with fictional data, without login. Rows live only in this tab's memory. */
export function DemoFlow({ canSignIn }: { canSignIn: boolean }) {
  const today = todayInMexico();
  const [rows, setRows] = useState<SavedInstallment[]>([]);
  const cards = upcomingCards(rows, today);

  return (
    <div className="flex flex-col gap-6">
      {cards.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="demo-q">
          <h2 id="demo-q" className="text-2xl font-extrabold text-ink">
            Tus quincenas (ficticias)
          </h2>
          <QuincenaCards cards={cards} />
          <button
            type="button"
            onClick={() => setRows([])}
            className="min-h-12 rounded-xl border border-line bg-card px-4 text-base font-semibold"
          >
            Empezar de nuevo
          </button>
        </section>
      )}

      <ScanFlow today={today} demo={{ onConfirm: (r) => setRows((prev) => [...prev, ...r]), samples: SAMPLES }} />

      <PrePurchase saved={rows} today={today} />

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <p className="text-lg font-semibold">¿Quieres guardar tus pagos de verdad?</p>
        <p className="text-base text-muted">Para guardar necesitas entrar con Google. En esta prueba no se guarda nada.</p>
        {canSignIn && <GoogleButton />}
      </section>
    </div>
  );
}
