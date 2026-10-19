"use client";

import { useState } from "react";

import { AiTag } from "@/components/AiTag";
import { UploadCapture } from "@/components/UploadCapture";
import { requestRows } from "@/lib/extract-client";
import type { ExtractSource } from "@/lib/extract";
import { formatDate, quincenaLabel } from "@/lib/format";
import { checkCompleteness, completeRows, todayIso, type Completeness, type ParsedRow } from "@/lib/parse";
import { formatMXN, toCents, totalsByQuincena } from "@/lib/quincena";

interface Result {
  rows: ParsedRow[];
  source: ExtractSource;
  check: Completeness;
  notice?: string;
}

/** Upload → OCR text → /api/extract → never-undercount guard → totals (only when complete). */
export function ScanFlow({ demo = false }: { demo?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onText(text: string) {
    setBusy(true);
    setResult(null);
    const { rows, source, notice } = await requestRows(text, demo);
    // The server already ran the guard; run it again here against the same raw text.
    setResult({ rows, source, notice, check: checkCompleteness(rows, text, todayIso()) });
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <UploadCapture onText={onText} />

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
              : "Lectura automática sin IA"}
          </p>
          {result.notice && <p className="text-base text-muted">{result.notice}</p>}

          {result.check.status === "empty" && (
            <p role="status" className="rounded-xl bg-coral-soft p-4 text-base text-ink">
              No encontramos fechas ni montos en esta captura. Prueba con otra más clara.
            </p>
          )}

          {result.check.status === "incomplete" && (
            <div role="alert" className="rounded-xl border-2 border-coral bg-coral-soft p-4 text-ink">
              <p className="text-lg font-bold">Encontramos montos sin fecha. Complétalos antes de sumar.</p>
              <p className="mt-1 text-base">
                Leímos {result.check.amounts} {result.check.amounts === 1 ? "monto" : "montos"} y{" "}
                {result.check.dates} {result.check.dates === 1 ? "fecha" : "fechas"}. Por eso todavía no
                sumamos nada.
              </p>
            </div>
          )}

          {result.rows.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Pagos leídos">
              {result.rows.map((row, i) => {
                const incomplete = row.due_date === null || row.amount === null;
                return (
                  <li
                    key={i}
                    className={`flex flex-col gap-1.5 rounded-2xl border bg-card p-4 ${
                      incomplete ? "border-2 border-coral" : "border-line"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-lg">
                      <span className={row.due_date ? "font-semibold" : "font-semibold text-coral"}>
                        {row.due_date ? formatDate(row.due_date) : "Falta la fecha"}
                      </span>
                      <span className={row.amount !== null ? "font-bold" : "font-bold text-coral"}>
                        {row.amount !== null ? formatMXN(toCents(row.amount)) : "Falta el monto"}
                      </span>
                    </div>
                    <AiTag />
                    <p className="truncate text-sm text-muted">Texto leído: {row.source_line}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {result.check.status === "complete" && <Totals rows={completeRows(result.rows)} />}
        </div>
      )}
    </section>
  );
}

function Totals({ rows }: { rows: { due_date: string; amount: number }[] }) {
  const totals = totalsByQuincena(rows);
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-extrabold text-ink">Así quedan tus quincenas</h2>
      <p className="text-base text-muted">Con esta captura. Todavía no se guarda nada.</p>
      <ul className="flex flex-col gap-2">
        {totals.map((t) => (
          <li key={t.quincena.payday} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-base text-muted">{quincenaLabel(t.quincena)}</p>
            <p className="text-2xl font-extrabold text-ink">{formatMXN(t.total)}</p>
            <p className="text-base text-muted">
              {t.count} {t.count === 1 ? "pago" : "pagos"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
