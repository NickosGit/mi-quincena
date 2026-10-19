// Quincena engine: buckets installments into Mexico's twice-monthly pay periods.
// All money math is done in integer cents; pesos only appear at the edges
// (input amounts and formatMXN for display).

/** Integer number of cents (MXN). */
export type Cents = number;

export type Half = 1 | 2;

export interface Quincena {
  year: number;
  /** 1–12 */
  month: number;
  /** 1 = days 1–15 (payday 15th), 2 = day 16–end (payday last day of month). */
  half: Half;
  /** ISO date "YYYY-MM-DD" of the quincena's payday. */
  payday: string;
}

export interface InstallmentRow {
  /** ISO date "YYYY-MM-DD". */
  due_date: string;
  /** Pesos, at most 2 decimals (matches numeric(10,2) in the DB). */
  amount: number;
}

export interface QuincenaTotal {
  quincena: Quincena;
  total: Cents;
  count: number;
}

export interface Installment {
  quincena: Quincena;
  amount: Cents;
}

export interface QuincenaImpact {
  quincena: Quincena;
  added: Cents;
  alreadyOwed: Cents;
  newTotal: Cents;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseIsoDate(date: string): { year: number; month: number; day: number } {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

function makeQuincena(year: number, month: number, half: Half): Quincena {
  const day = half === 1 ? 15 : lastDayOfMonth(year, month);
  return { year, month, half, payday: `${year}-${pad2(month)}-${pad2(day)}` };
}

/** Days 1–15 → half 1 (payday 15th); day 16–end → half 2 (payday last day). */
export function quincenaOf(date: string): Quincena {
  const { year, month, day } = parseIsoDate(date);
  return makeQuincena(year, month, day <= 15 ? 1 : 2);
}

/** Monotonic index: consecutive quincenas differ by exactly 1. */
function ordinal(q: Pick<Quincena, "year" | "month" | "half">): number {
  return q.year * 24 + (q.month - 1) * 2 + (q.half - 1);
}

function fromOrdinal(n: number): Quincena {
  const year = Math.floor(n / 24);
  const rest = n - year * 24;
  return makeQuincena(year, Math.floor(rest / 2) + 1, ((rest % 2) + 1) as Half);
}

export function quincenaKey(q: Quincena): string {
  return `${q.year}-${pad2(q.month)}-${q.half}`;
}

export function compareQuincenas(a: Quincena, b: Quincena): number {
  return ordinal(a) - ordinal(b);
}

export function addQuincenas(q: Quincena, n: number): Quincena {
  return fromOrdinal(ordinal(q) + n);
}

export function nextQuincena(q: Quincena): Quincena {
  return addQuincenas(q, 1);
}

/** Converts pesos to integer cents; rejects non-finite values and sub-cent precision. */
export function toCents(pesos: number): Cents {
  if (!Number.isFinite(pesos)) throw new Error(`Invalid amount: ${pesos}`);
  const cents = Math.round(pesos * 100);
  // Tolerance absorbs binary noise (e.g. 224.75 * 100), not a real third decimal.
  if (Math.abs(pesos * 100 - cents) > 1e-6) {
    throw new Error(`Amount has more than 2 decimals: ${pesos}`);
  }
  return cents;
}

/** Formats cents as MXN for display, e.g. 249050 → "$2,490.50". */
export function formatMXN(cents: Cents): string {
  if (!Number.isInteger(cents)) throw new Error(`Cents must be an integer: ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const pesos = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${pesos}.${pad2(abs % 100)}`;
}

/** Totals per quincena, ordered from earliest to latest. */
export function totalsByQuincena(rows: InstallmentRow[]): QuincenaTotal[] {
  const buckets = new Map<string, QuincenaTotal>();
  for (const row of rows) {
    const quincena = quincenaOf(row.due_date);
    const key = quincenaKey(quincena);
    const bucket = buckets.get(key) ?? { quincena, total: 0, count: 0 };
    bucket.total += toCents(row.amount);
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => compareQuincenas(a.quincena, b.quincena));
}

/**
 * Splits a purchase into n installments over consecutive quincenas starting at
 * startQuincena. Each installment gets floor(total / n) cents; the remainder
 * goes to the last one so the installments always add up to the exact amount.
 */
export function splitPurchase(amount: number, n: number, startQuincena: Quincena): Installment[] {
  if (!Number.isInteger(n) || n < 1) throw new Error(`n must be a positive integer: ${n}`);
  const total = toCents(amount);
  if (total <= 0) throw new Error(`Amount must be positive: ${amount}`);
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => ({
    quincena: addQuincenas(startQuincena, i),
    amount: i === n - 1 ? base + remainder : base,
  }));
}

/** What a new purchase would add to each quincena it touches, given what is already owed. */
export function prePurchaseImpact(
  rows: InstallmentRow[],
  amount: number,
  n: number,
  start: Quincena,
): QuincenaImpact[] {
  const owed = new Map(totalsByQuincena(rows).map((t) => [quincenaKey(t.quincena), t.total]));
  return splitPurchase(amount, n, start).map(({ quincena, amount: added }) => {
    const alreadyOwed = owed.get(quincenaKey(quincena)) ?? 0;
    return { quincena, added, alreadyOwed, newTotal: alreadyOwed + added };
  });
}
