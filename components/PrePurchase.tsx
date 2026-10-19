"use client";

import { useMemo, useState } from "react";

import { defaultStart, impactLines, startOptions } from "@/lib/prepurchase";
import { quincenaKey } from "@/lib/quincena";
import type { SavedInstallment } from "@/lib/review";
import { parseAmountInput } from "@/lib/review";
import { prePurchaseSchema } from "@/lib/schemas";

/**
 * "¿Vas a comprar algo?" Shows what a purchase would add to each quincena it
 * touches. Numbers only: neutral styling, no warnings, nothing that stops you.
 */
export function PrePurchase({ saved, today }: { saved: SavedInstallment[]; today: string }) {
  const options = useMemo(() => startOptions(today), [today]);
  const [amount, setAmount] = useState("");
  const [n, setN] = useState("4");
  const [start, setStart] = useState(() => quincenaKey(defaultStart(today)));
  const [pay, setPay] = useState("");

  const parsed = prePurchaseSchema.safeParse({ amount: parseAmountInput(amount) ?? NaN, n: Number(n) });
  const startQ = options.find((o) => quincenaKey(o.quincena) === start)?.quincena ?? options[1].quincena;
  const payValue = pay.trim() === "" ? null : parseAmountInput(pay);
  const lines = parsed.success ? impactLines(saved, parsed.data.amount, parsed.data.n, startQ, payValue) : [];
  const amountError = amount.trim() !== "" && !parsed.success ? parsed.error.issues.find((i) => i.path[0] === "amount")?.message : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4" aria-labelledby="pp-title">
      <h2 id="pp-title" className="text-2xl font-extrabold text-ink">
        ¿Vas a comprar algo?
      </h2>

      <label className="flex flex-col gap-1 text-base">
        Escribe el monto ($)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="899"
          className="min-h-12 rounded-xl border border-line bg-background px-3 text-lg"
          aria-describedby="pp-amount-help"
        />
        <span id="pp-amount-help" className="text-sm text-muted">
          {amountError ?? "De $1 a $100,000."}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-base">
          ¿En cuántas quincenas?
          <select
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-background px-3 text-lg"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-base">
          ¿Cuánto cobras por quincena? <span className="text-sm text-muted">(opcional)</span>
          <input
            inputMode="decimal"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            placeholder="No es necesario"
            className="min-h-12 rounded-xl border border-line bg-background px-3 text-lg"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-base">
        Primer pago
        <select
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="min-h-12 rounded-xl border border-line bg-background px-3 text-base"
        >
          {options.map((o) => (
            <option key={quincenaKey(o.quincena)} value={quincenaKey(o.quincena)}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {lines.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite" aria-label="Cuánto le suma a cada quincena">
          {lines.map((l) => (
            <li key={l.quincena.payday} className="rounded-xl bg-background p-3 text-lg">
              {l.sentence}
              {l.left && <span className="block text-base text-muted">{l.left}</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-base text-muted">Tú decides. Mi Quincena solo te muestra la cuenta.</p>
      <p className="text-sm text-muted">Tu pago por quincena no se guarda.</p>
    </section>
  );
}
