import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkCompleteness,
  completeRows,
  countAmounts,
  countDates,
  regexRows,
  truncateText,
  type ParsedRow,
} from "@/lib/parse";
import { totalsByQuincena } from "@/lib/quincena";

const TODAY = "2026-10-18";
const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, "..", "fixtures", name), "utf8");
const CLEAN = fixture("clean.txt");
const BLURRED = fixture("blurred.txt");
const EXPECTED: { rows: { due_date: string; amount: number }[] } = JSON.parse(fixture("expected.json"));

describe("clean fixture OCR text", () => {
  it("counts 12 amounts and 12 dates", () => {
    expect(countAmounts(CLEAN)).toBe(12);
    expect(countDates(CLEAN, TODAY)).toBe(12);
  });

  it("pairs into the 12 expected rows, all complete", () => {
    const rows = regexRows(CLEAN, TODAY);
    expect(rows.map(({ due_date, amount }) => ({ due_date, amount }))).toEqual(
      EXPECTED.rows.map(({ due_date, amount }) => ({ due_date, amount })),
    );
    expect(checkCompleteness(rows, CLEAN, TODAY)).toEqual({ status: "complete", amounts: 12, dates: 12 });
  });

  it("1st Nov 2026 quincena totals $2,490.50", () => {
    const totals = totalsByQuincena(completeRows(regexRows(CLEAN, TODAY)));
    expect(totals[0]).toMatchObject({ quincena: { payday: "2026-11-15" }, total: 249050, count: 3 });
  });
});

describe("blurred fixture OCR text", () => {
  it("reads all 12 amounts but only 9 dates", () => {
    expect(countAmounts(BLURRED)).toBe(12);
    expect(countDates(BLURRED, TODAY)).toBe(9);
  });

  it("is incomplete, so totals are never computed ($2,141.50 never appears)", () => {
    const rows = regexRows(BLURRED, TODAY);
    const result = checkCompleteness(rows, BLURRED, TODAY);
    expect(result.status).toBe("incomplete");
    expect(rows.some((r) => r.due_date === null)).toBe(true);
    expect(rows.some((r) => r.amount === null)).toBe(true);
  });

  it("keeps every amount as a row, so filling dates can restore the full total", () => {
    const amounts = regexRows(BLURRED, TODAY).flatMap((r) => (r.amount === null ? [] : [r.amount]));
    expect(amounts.sort()).toEqual(EXPECTED.rows.map((r) => r.amount).sort());
  });
});

describe("countAmounts", () => {
  it.each([
    ["$1,234.50", 1],
    ["1234.50", 1],
    ["$249", 1],
    ["$ 249.00", 1],
    ["1,249.00", 1],
    ["Total $349.00 y $892.50", 2],
  ])("%j → %i", (text, n) => {
    expect(countAmounts(text)).toBe(n);
  });

  it.each(["1 nov 2026", "Pago 3 de 6", "2026", "15.11.2026", "15/11/2026", "Celular"])(
    "%j has no amounts",
    (text) => {
      expect(countAmounts(text)).toBe(0);
    },
  );
});

describe("countDates", () => {
  it.each([
    ["15/11/2026", 1],
    ["15-11-26", 1],
    ["15 nov", 1],
    ["15 Nov.", 1],
    ["15 de noviembre", 1],
    ["15 de noviembre de 2026", 1],
    ["nov 15", 1],
    ["Nov 15, 2026", 1],
    ["1 nov 2026 $349.00", 1],
    ["1 sept y 16 sep", 2],
  ])("%j → %i", (text, n) => {
    expect(countDates(text, TODAY)).toBe(n);
  });

  it.each(["31 nov", "30/02/2026", "sin marca 12", "12 marcas", "L nov 2026", "26", "127", "nov 2026"])(
    "%j is not a date",
    (text) => {
      expect(countDates(text, TODAY)).toBe(0);
    },
  );
});

describe("regexRows", () => {
  const one = (text: string) => regexRows(text, TODAY).map(({ due_date, amount }) => ({ due_date, amount }));

  it.each([
    ["15/11/2026 $224.75", "2026-11-15", 224.75],
    ["15 de noviembre de 2026 · $1,234.50", "2026-11-15", 1234.5],
    ["nov 30 $249", "2026-11-30", 249],
  ])("%j → %s %d", (text, date, amount) => {
    expect(one(text)).toEqual([{ due_date: date, amount }]);
  });

  it("infers the nearest year on or after today when it's missing", () => {
    expect(one("15 nov $1.00")[0].due_date).toBe("2026-11-15");
    expect(one("18 oct $1.00")[0].due_date).toBe("2026-10-18");
    expect(one("10 oct $1.00")[0].due_date).toBe("2027-10-10");
    expect(one("15 ene $1.00")[0].due_date).toBe("2027-01-15");
  });

  it("keeps half-read lines as rows with the missing field null", () => {
    expect(one("L nov 2026 $349.00")).toEqual([{ due_date: null, amount: 349 }]);
    expect(one("5 dic 2026")).toEqual([{ due_date: "2026-12-05", amount: null }]);
    expect(one("1 dic 2026 $349.00 $10.00")).toEqual([
      { due_date: "2026-12-01", amount: 349 },
      { due_date: null, amount: 10 },
    ]);
  });

  it("skips lines with neither", () => {
    expect(regexRows("Calendario de pagos\n\nSúper\n", TODAY)).toEqual([]);
  });

  it("keeps the source line for review", () => {
    expect(regexRows("  5 nov 2026   $1,249.00  ", TODAY)[0].source_line).toBe("5 nov 2026   $1,249.00");
  });
});

describe("checkCompleteness", () => {
  const row = (due_date: string | null, amount: number | null): ParsedRow => ({ due_date, amount, source_line: "" });

  it("is empty when nothing was read", () => {
    expect(checkCompleteness([], "Calendario de pagos", TODAY).status).toBe("empty");
  });

  it("is incomplete when any row lacks a field", () => {
    expect(checkCompleteness([row("2026-11-15", 10), row(null, 20)], "", TODAY)).toMatchObject({
      status: "incomplete",
      missing: 1,
    });
  });

  it("is incomplete when the text has more amounts than dates, even if the rows look complete", () => {
    // e.g. a structurer that invented a date for the second amount
    const text = "15 nov $100.00\n$200.00";
    expect(checkCompleteness([row("2026-11-15", 100), row("2026-11-30", 200)], text, TODAY)).toMatchObject({
      status: "incomplete",
      amounts: 2,
      dates: 1,
      missing: 0,
    });
  });
});

describe("truncateText", () => {
  it("keeps at most 4,000 characters", () => {
    expect(truncateText("x".repeat(5000))).toHaveLength(4000);
    expect(truncateText("abc")).toBe("abc");
  });
});
