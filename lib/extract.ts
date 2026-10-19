// Turns OCR text into installment rows. The LLM may only re-pair what the regex
// reader already found in the text: same amounts, dates that appear in the text.
// Anything else falls back to the regex rows. The never-undercount guard always
// runs last, against the raw text.

import { checkCompleteness, regexRows, type Completeness, type ParsedRow } from "./parse";
import { toCents } from "./quincena";
import { llmOutputSchema } from "./schemas";

export type ExtractSource = "llm" | "regex";

export type FallbackReason = "no_llm" | "llm_error" | "invalid_output" | "amounts_mismatch";

export interface ExtractResult {
  rows: ParsedRow[];
  source: ExtractSource;
  check: Completeness;
  fallback?: FallbackReason;
}

function multiset<T>(values: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function sameMultiset<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const ma = multiset(a);
  const mb = multiset(b);
  for (const [k, n] of ma) if (mb.get(k) !== n) return false;
  return true;
}

function centsOrNull(amount: number): number | null {
  try {
    return toCents(amount);
  } catch {
    return null;
  }
}

/**
 * Accepts the LLM rows only if they keep exactly the amounts the regex found (so
 * none is dropped, changed or invented). Each LLM date must be one the regex found
 * in the text; otherwise it becomes null.
 */
export function reconcile(
  llmRows: ParsedRow[],
  baseline: ParsedRow[],
): { rows: ParsedRow[] } | { rejected: "amounts_mismatch" } {
  const llmCents = llmRows.flatMap((r) => (r.amount === null ? [] : [centsOrNull(r.amount)]));
  const baseCents = baseline.flatMap((r) => (r.amount === null ? [] : [toCents(r.amount)]));
  if (llmCents.includes(null) || !sameMultiset(llmCents, baseCents)) return { rejected: "amounts_mismatch" };

  const available = multiset(baseline.flatMap((r) => (r.due_date ? [r.due_date] : [])));
  const rows = llmRows.map((r) => {
    let due_date: string | null = null;
    if (r.due_date && (available.get(r.due_date) ?? 0) > 0) {
      available.set(r.due_date, available.get(r.due_date)! - 1);
      due_date = r.due_date;
    }
    return { due_date, amount: r.amount, source_line: r.source_line };
  });
  return { rows };
}

/**
 * @param llm returns the model's parsed JSON, or null when no model is configured.
 *            Throwing counts as an LLM error.
 */
export async function extractRows(
  text: string,
  today: string,
  llm: (text: string, today: string) => Promise<unknown | null>,
): Promise<ExtractResult> {
  const baseline = regexRows(text, today);
  const fallback = (reason: FallbackReason): ExtractResult => ({
    rows: baseline,
    source: "regex",
    check: checkCompleteness(baseline, text, today),
    fallback: reason,
  });

  let raw: unknown;
  try {
    raw = await llm(text, today);
  } catch {
    return fallback("llm_error");
  }
  if (raw === null) return fallback("no_llm");

  const parsed = llmOutputSchema.safeParse(raw);
  if (!parsed.success) return fallback("invalid_output");

  const result = reconcile(parsed.data.rows, baseline);
  if ("rejected" in result) return fallback(result.rejected);

  return { rows: result.rows, source: "llm", check: checkCompleteness(result.rows, text, today) };
}
