// Pre-purchase check (F6). Shows numbers only: no verdicts, no warnings.

import { paydayLabel, quincenaLabel } from "./format";
import { addQuincenas, formatMXN, nextQuincena, prePurchaseImpact, quincenaOf, toCents, type Quincena } from "./quincena";
import type { SavedInstallment } from "./review";

export interface ImpactLine {
  quincena: Quincena;
  sentence: string;
  /** "Te quedarían $X." / "Te faltarían $X." when the user typed their pay. */
  left?: string;
}

/** Choices for "first payment": the current quincena and the next 24. Default = the next one. */
export function startOptions(today: string): { quincena: Quincena; label: string }[] {
  const current = quincenaOf(today);
  return Array.from({ length: 25 }, (_, i) => {
    const q = addQuincenas(current, i);
    return { quincena: q, label: `${quincenaLabel(q)} (paga el ${paydayLabel(q)})` };
  });
}

export function defaultStart(today: string): Quincena {
  return nextQuincena(quincenaOf(today));
}

export function impactLines(
  saved: SavedInstallment[],
  amount: number,
  n: number,
  start: Quincena,
  pay?: number | null,
): ImpactLine[] {
  return prePurchaseImpact(saved, amount, n, start).map(({ quincena, added, alreadyOwed, newTotal }) => {
    const sentence =
      `Esto suma ${formatMXN(added)} a tu quincena del ${paydayLabel(quincena)}. ` +
      `Ya debes ${formatMXN(alreadyOwed)}. Total: ${formatMXN(newTotal)}.`;
    if (pay === undefined || pay === null) return { quincena, sentence };
    const rest = toCents(pay) - newTotal;
    const left = rest >= 0 ? `Te quedarían ${formatMXN(rest)}.` : `Te faltarían ${formatMXN(-rest)}.`;
    return { quincena, sentence, left };
  });
}
