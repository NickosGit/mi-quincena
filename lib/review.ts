// Review step (F5): editable rows → validated installments, and the dashboard's
// quincena cards. Pure, so the same code runs signed-in, in demo mode and in tests.

import { installmentSchema, planLabelSchema } from "./schemas";
import { compareQuincenas, quincenaKey, quincenaOf, toCents, type Cents, type Quincena } from "./quincena";

/** What the review table edits: raw input strings. */
export interface DraftRow {
  due_date: string; // "" when missing
  amount: string; // "" when missing
  source_line: string;
}

export interface SavedInstallment {
  due_date: string;
  amount: number;
  label: string;
}

export type ReviewCheck =
  | { ok: true; installments: SavedInstallment[] }
  | { ok: false; rowErrors: (string | null)[]; labelError: string | null; formError: string | null };

/** Parses "1,249.50", "$ 899" or "224.75" typed by the user. */
export function parseAmountInput(input: string): number | null {
  const clean = input.replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

export function toDraft(rows: { due_date: string | null; amount: number | null; source_line: string }[]): DraftRow[] {
  return rows.map((r) => ({
    due_date: r.due_date ?? "",
    amount: r.amount === null ? "" : r.amount.toFixed(2),
    source_line: r.source_line,
  }));
}

export function isDraftComplete(row: DraftRow): boolean {
  return row.due_date !== "" && parseAmountInput(row.amount) !== null;
}

/** "Guardar" is enabled only when this returns ok. */
export function checkReview(rows: DraftRow[], label: string, today: string): ReviewCheck {
  const schema = installmentSchema(today);
  const labelParsed = planLabelSchema.safeParse(label);
  const labelError = labelParsed.success ? null : labelParsed.error.issues[0].message;

  const installments: SavedInstallment[] = [];
  const rowErrors = rows.map((row) => {
    if (row.due_date === "") return "Falta la fecha.";
    const amount = parseAmountInput(row.amount);
    if (amount === null) return row.amount === "" ? "Falta el monto." : "Escribe el monto como 1249.50.";
    const parsed = schema.safeParse({ due_date: row.due_date, amount, label: labelParsed.success ? labelParsed.data : "x" });
    if (!parsed.success) return parsed.error.issues[0].message;
    installments.push(parsed.data);
    return null;
  });

  const formError = rows.length === 0 ? "No hay pagos para guardar." : null;
  if (labelError || formError || rowErrors.some(Boolean)) return { ok: false, rowErrors, labelError, formError };
  return { ok: true, installments };
}

export interface QuincenaCard {
  quincena: Quincena;
  total: Cents;
  /** Distinct plan labels with a payment in this quincena. */
  plans: number;
  rows: SavedInstallment[];
}

/** Upcoming quincenas only (the current one included), in order, totals in cents. */
export function upcomingCards(rows: SavedInstallment[], today: string): QuincenaCard[] {
  const current = quincenaOf(today);
  const cards = new Map<string, QuincenaCard>();
  for (const row of rows) {
    const quincena = quincenaOf(row.due_date);
    if (compareQuincenas(quincena, current) < 0) continue;
    const key = quincenaKey(quincena);
    const card = cards.get(key) ?? { quincena, total: 0, plans: 0, rows: [] };
    card.total += toCents(row.amount);
    card.rows.push(row);
    cards.set(key, card);
  }
  return [...cards.values()]
    .map((c) => ({
      ...c,
      plans: new Set(c.rows.map((r) => r.label)).size,
      rows: [...c.rows].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    }))
    .sort((a, b) => compareQuincenas(a.quincena, b.quincena));
}
