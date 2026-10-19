// Regex reading of OCR text from a BNPL payment calendar, plus the
// never-undercount guard. Used as the F3 reader and as the fallback when the
// LLM is unavailable (F4). Dates come out as ISO "YYYY-MM-DD", amounts as pesos.

export const MAX_TEXT_LENGTH = 4000;

export interface ParsedRow {
  due_date: string | null;
  amount: number | null;
  source_line: string;
}

export type Completeness =
  | { status: "complete"; amounts: number; dates: number }
  | { status: "incomplete"; amounts: number; dates: number; missing: number; truncated?: boolean }
  | { status: "empty"; amounts: number; dates: number };

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

// Longest names first so "noviembre" wins over "nov".
const MONTH = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

// One alternation so matches never overlap: numeric, day-first, then month-first.
//   15/11/2026 · 15-11-26 · 15 nov · 15 de noviembre (de 2026) · nov 15(, 2026)
const DATE_RE = new RegExp(
  String.raw`\b(?<nd>\d{1,2})[/-](?<nm>\d{1,2})[/-](?<ny>\d{4}|\d{2})\b` +
    String.raw`|\b(?<dd>\d{1,2})\s+(?:de\s+)?(?<dm>${MONTH})\.?(?:\s+(?:de(?:l)?\s+)?(?<dy>\d{4}))?(?![\p{L}])` +
    String.raw`|(?<![\p{L}])(?<mm>${MONTH})\.?\s+(?<md>\d{1,2})\b(?:,?\s+(?<my>\d{4}))?`,
  "giu",
);

// "$1,234.50", "$ 249", "$249.00", or a bare "1,234.50" / "1234.50". Bare numbers
// need cents so years and day numbers never count as money, and can't be followed
// by ".digit" so a dotted date like 15.11.2026 isn't read as $15.11.
const AMOUNT_RE =
  /\$\s?(?<a>\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)(?![\d,.]*\d)|(?<![\d$.,])(?<b>\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\.?\d)/g;

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > lastDay(year, month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today's date as ISO in the runtime's local time zone. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** No year on the screen: the nearest date on or after today with that month/day. */
function inferYear(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = iso(y, month, day);
    if (d && d >= today) return d;
  }
  // Feb 29 with no leap year ahead in the next two years.
  return null;
}

interface Hit {
  index: number;
  value: string | null;
}

function dateHits(line: string, today: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of line.matchAll(DATE_RE)) {
    const g = m.groups!;
    let value: string | null;
    if (g.nd) {
      const y = g.ny.length === 2 ? 2000 + Number(g.ny) : Number(g.ny);
      value = iso(y, Number(g.nm), Number(g.nd));
    } else {
      const month = MONTHS[(g.dm ?? g.mm).toLowerCase()];
      const day = Number(g.dd ?? g.md);
      const year = g.dy ?? g.my;
      value = year ? iso(Number(year), month, day) : inferYear(month, day, today);
    }
    // "31 nov" is not a date: it doesn't count, so it can't hide a missing one.
    if (value) hits.push({ index: m.index, value });
  }
  return hits;
}

function amountHits(line: string): { index: number; value: number }[] {
  return [...line.matchAll(AMOUNT_RE)].map((m) => ({
    index: m.index,
    value: Number((m.groups!.a ?? m.groups!.b).replace(/,/g, "")),
  }));
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function countAmounts(text: string): number {
  return lines(text).reduce((n, l) => n + amountHits(l).length, 0);
}

export function countDates(text: string, today = todayIso()): number {
  return lines(text).reduce((n, l) => n + dateHits(l, today).length, 0);
}

/**
 * Best-effort pairing per line: the k-th date on a line goes with the k-th amount.
 * Whatever is left over becomes a row with the missing field set to null.
 */
export function regexRows(text: string, today = todayIso()): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of lines(text)) {
    const dates = dateHits(line, today);
    const amounts = amountHits(line);
    const n = Math.max(dates.length, amounts.length);
    for (let i = 0; i < n; i++) {
      rows.push({
        due_date: dates[i]?.value ?? null,
        amount: amounts[i]?.value ?? null,
        source_line: line,
      });
    }
  }
  return rows;
}

/**
 * Never undercount silently: totals are allowed only when the raw text has no
 * more amounts than dates AND every row has both a date and an amount AND the
 * OCR text wasn't cut at MAX_TEXT_LENGTH (cut text can lose whole payments).
 */
export function checkCompleteness(
  rows: ParsedRow[],
  text: string,
  today = todayIso(),
  opts: { truncated?: boolean } = {},
): Completeness {
  const amounts = countAmounts(text);
  const dates = countDates(text, today);
  if (rows.length === 0) return { status: "empty", amounts, dates };
  const missing = rows.filter((r) => r.due_date === null || r.amount === null).length;
  if (opts.truncated) return { status: "incomplete", amounts, dates, missing, truncated: true };
  if (amounts > dates || missing > 0) return { status: "incomplete", amounts, dates, missing };
  return { status: "complete", amounts, dates };
}

/** Rows that passed the guard, narrowed for the quincena engine. */
export function completeRows(rows: ParsedRow[]): { due_date: string; amount: number }[] {
  return rows.flatMap((r) => (r.due_date && r.amount !== null ? [{ due_date: r.due_date, amount: r.amount }] : []));
}

export function truncateText(text: string): string {
  return text.slice(0, MAX_TEXT_LENGTH);
}
