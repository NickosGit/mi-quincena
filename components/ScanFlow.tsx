"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReviewRows } from "@/components/ReviewRows";
import { UploadCapture } from "@/components/UploadCapture";
import { requestRows } from "@/lib/extract-client";
import type { ExtractSource } from "@/lib/extract";
import { checkCompleteness, type Completeness, type ParsedRow } from "@/lib/parse";
import type { SavedInstallment } from "@/lib/review";
import { createClient } from "@/lib/supabase/client";

interface Result {
  rows: ParsedRow[];
  source: ExtractSource;
  check: Completeness;
  notice?: string;
}

/**
 * Upload → OCR text → /api/extract → never-undercount guard → editable review.
 * Signed in, the review saves to Supabase. In demo mode it hands the rows back
 * to the page and nothing is stored.
 */
export function ScanFlow({
  today,
  demo,
}: {
  today: string;
  demo?: { onConfirm: (rows: SavedInstallment[]) => void; samples?: { file: string; label: string }[] };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [round, setRound] = useState(0);

  async function onText(text: string) {
    setBusy(true);
    setResult(null);
    const { rows, source, notice } = await requestRows(text, !!demo);
    // The server already ran the guard; run it again here against the same raw text.
    setResult({ rows, source, notice, check: checkCompleteness(rows, text, today) });
    setRound((r) => r + 1);
    setBusy(false);
  }

  async function save(installments: SavedInstallment[]): Promise<string | null> {
    if (demo) {
      demo.onConfirm(installments);
      setResult(null);
      return null;
    }
    // user_id defaults to auth.uid(); RLS rejects any other owner.
    const { error } = await createClient().from("installments").insert(installments);
    if (error) return "No pudimos guardar tus pagos. Intenta otra vez.";
    setResult(null);
    router.refresh();
    return null;
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Subir captura">
      <UploadCapture onText={onText} samples={demo?.samples} />

      {busy && (
        <p role="status" className="rounded-2xl border border-line bg-card p-4 text-base font-semibold">
          Ordenando tus pagos…
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-base text-muted">
            {result.source === "llm"
              ? "Ordenado con IA (Gemini) a partir del texto de tu captura. Revisa cada pago."
              : "Lectura automática sin IA. Revisa cada pago."}
          </p>
          {result.notice && <p className="text-base text-muted">{result.notice}</p>}

          {result.check.status === "empty" && (
            <p role="status" className="rounded-xl bg-coral-soft p-4 text-base text-ink">
              No encontramos fechas ni montos en esta captura. Prueba con otra más clara o agrega los pagos a mano.
            </p>
          )}

          {result.check.status === "incomplete" && (
            <div role="alert" className="rounded-xl border-2 border-coral bg-coral-soft p-4 text-ink">
              <p className="text-lg font-bold">Encontramos montos sin fecha. Complétalos antes de sumar.</p>
              <p className="mt-1 text-base">
                Leímos {result.check.amounts} {result.check.amounts === 1 ? "monto" : "montos"} y{" "}
                {result.check.dates} {result.check.dates === 1 ? "fecha" : "fechas"}. No sumamos nada hasta que
                cada pago tenga fecha y monto.
              </p>
            </div>
          )}

          <ReviewRows
            key={round}
            rows={result.rows}
            today={today}
            confirmLabel={demo ? "Ver mis quincenas (sin guardar)" : "Guardar"}
            onConfirm={save}
          />
        </div>
      )}
    </section>
  );
}
