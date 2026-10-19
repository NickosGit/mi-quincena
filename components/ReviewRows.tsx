"use client";

import { useState } from "react";

import { AiTag } from "@/components/AiTag";
import { addMonthsIso } from "@/lib/schemas";
import { checkReview, isDraftComplete, parseAmountInput, toDraft, type DraftRow, type SavedInstallment } from "@/lib/review";
import type { ParsedRow } from "@/lib/parse";

/**
 * Editable review of what was read. Every row keeps the AI tag. The confirm button
 * stays disabled until every row has a valid date and amount and the plan has a name.
 */
export function ReviewRows({
  rows: initial,
  today,
  confirmLabel,
  onConfirm,
}: {
  rows: ParsedRow[];
  today: string;
  confirmLabel: string;
  /** Returns a Spanish error message, or null on success. */
  onConfirm: (installments: SavedInstallment[]) => Promise<string | null>;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDraft(initial));
  const [label, setLabel] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = checkReview(rows, label, today);
  const update = (i: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function confirm() {
    if (!check.ok) return;
    setBusy(true);
    setError(null);
    const message = await onConfirm(check.installments);
    setBusy(false);
    if (message) setError(message);
  }

  const missing = rows.filter((r) => !isDraftComplete(r)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="plan-label" className="text-lg font-semibold">
          ¿Cómo se llama este plan?
        </label>
        <input
          id="plan-label"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Celular, Tenis, Súper…"
          className="min-h-12 rounded-xl border border-line bg-card px-4 text-lg"
          aria-invalid={!check.ok && !!check.labelError && touched}
          aria-describedby="plan-label-help"
        />
        <p id="plan-label-help" className="text-base text-muted">
          {!check.ok && check.labelError && touched ? check.labelError : "Hasta 40 letras. Solo tú lo ves."}
        </p>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Pagos leídos">
        {rows.map((row, i) => {
          const incomplete = !isDraftComplete(row);
          const rowError = !check.ok ? check.rowErrors[i] : null;
          const dateOnly = row.due_date !== "" && row.amount === "";
          return (
            <li
              key={i}
              className={`flex flex-col gap-3 rounded-2xl bg-card p-4 ${incomplete ? "border-2 border-coral" : "border border-line"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold">Pago {i + 1}</span>
                <AiTag />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-base">
                  Fecha
                  <input
                    type="date"
                    value={row.due_date}
                    min={addMonthsIso(today, -1)}
                    max={addMonthsIso(today, 24)}
                    onChange={(e) => update(i, { due_date: e.target.value })}
                    className="min-h-12 rounded-xl border border-line bg-background px-3 text-lg"
                  />
                </label>
                <label className="flex flex-col gap-1 text-base">
                  Monto ($)
                  <input
                    inputMode="decimal"
                    value={row.amount}
                    placeholder="0.00"
                    onChange={(e) => update(i, { amount: e.target.value })}
                    onBlur={() => {
                      const n = parseAmountInput(row.amount);
                      if (n !== null) update(i, { amount: n.toFixed(2) });
                    }}
                    className="min-h-12 rounded-xl border border-line bg-background px-3 text-lg"
                  />
                </label>
              </div>
              {rowError && <p className="text-base font-semibold text-coral">{rowError}</p>}
              {dateOnly && (
                <p className="text-base text-muted">
                  Fecha sin monto. Si este pago ya está en otra fila, quítala para no contarlo dos veces.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm text-muted">Texto leído: {row.source_line || "—"}</p>
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-base"
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { due_date: "", amount: "", source_line: "" }])}
        className="min-h-12 rounded-xl border border-dashed border-line bg-card text-base font-semibold"
      >
        + Agregar un pago que faltó
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-coral-soft p-3 text-base text-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={!check.ok || busy}
        className="min-h-14 rounded-2xl bg-ink px-5 text-lg font-bold text-white disabled:opacity-40"
      >
        {busy ? "Guardando…" : confirmLabel}
      </button>
      {!check.ok && (
        <p className="text-base text-muted" aria-live="polite">
          {missing > 0
            ? `Completa ${missing === 1 ? "1 pago" : `${missing} pagos`} para continuar.`
            : check.labelError
              ? "Ponle nombre al plan para continuar."
              : (check.formError ?? "Revisa los pagos marcados.")}
        </p>
      )}
    </div>
  );
}
