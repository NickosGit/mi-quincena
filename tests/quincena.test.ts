import { describe, expect, it } from "vitest";
import {
  formatMXN,
  nextQuincena,
  prePurchaseImpact,
  quincenaOf,
  splitPurchase,
  toCents,
  totalsByQuincena,
  type InstallmentRow,
} from "@/lib/quincena";

// Synthetic rows built so the 1st Nov 2026 quincena owes $2,490.50 (the brief's
// clean-fixture figure). Not the OCR fixture itself; that arrives in F3.
const ROWS: InstallmentRow[] = [
  { due_date: "2026-11-01", amount: 1249.0 },
  { due_date: "2026-11-08", amount: 892.5 },
  { due_date: "2026-11-15", amount: 349.0 },
  { due_date: "2026-11-16", amount: 1249.0 },
  { due_date: "2026-11-30", amount: 892.5 },
  { due_date: "2026-12-01", amount: 1249.0 },
  { due_date: "2026-12-15", amount: 892.5 },
  { due_date: "2026-12-31", amount: 349.0 },
  { due_date: "2027-01-01", amount: 1249.0 },
  { due_date: "2027-01-10", amount: 892.5 },
  { due_date: "2027-01-16", amount: 349.0 },
  { due_date: "2027-01-31", amount: 349.0 },
];

describe("quincenaOf", () => {
  it.each([
    ["2026-11-01", 1, "2026-11-15"],
    ["2026-11-15", 1, "2026-11-15"],
    ["2026-11-16", 2, "2026-11-30"],
    ["2026-11-30", 2, "2026-11-30"],
    ["2026-12-31", 2, "2026-12-31"],
    ["2026-02-15", 1, "2026-02-15"],
    ["2026-02-16", 2, "2026-02-28"],
    ["2026-02-28", 2, "2026-02-28"],
    ["2028-02-28", 2, "2028-02-29"],
    ["2028-02-29", 2, "2028-02-29"],
  ])("%s → half %i, payday %s", (date, half, payday) => {
    const q = quincenaOf(date);
    expect(q.half).toBe(half);
    expect(q.payday).toBe(payday);
    expect(q.year).toBe(Number(date.slice(0, 4)));
    expect(q.month).toBe(Number(date.slice(5, 7)));
  });

  it.each(["2026-02-29", "2026-11-31", "2026-13-01", "2026-00-10", "15/11/2026", ""])(
    "rejects invalid date %j",
    (date) => {
      expect(() => quincenaOf(date)).toThrow();
    },
  );

  it("rolls from the last quincena of the year into January", () => {
    const next = nextQuincena(quincenaOf("2026-12-20"));
    expect(next).toEqual({ year: 2027, month: 1, half: 1, payday: "2027-01-15" });
  });
});

describe("totalsByQuincena", () => {
  it("groups, orders and totals in integer cents", () => {
    const totals = totalsByQuincena([...ROWS].reverse());
    expect(totals.map((t) => t.quincena.payday)).toEqual([
      "2026-11-15",
      "2026-11-30",
      "2026-12-15",
      "2026-12-31",
      "2027-01-15",
      "2027-01-31",
    ]);
    expect(totals[0]).toMatchObject({ total: 249050, count: 3 });
    expect(totals.map((t) => t.total)).toEqual([249050, 214150, 214150, 34900, 214150, 69800]);
    for (const t of totals) expect(Number.isInteger(t.total)).toBe(true);
  });

  it("does not drift the way float addition does", () => {
    // 0.1 + 0.2 !== 0.3 in floats; in cents it must be exactly 30.
    const rows = [
      { due_date: "2026-11-02", amount: 0.1 },
      { due_date: "2026-11-03", amount: 0.2 },
    ];
    expect(totalsByQuincena(rows)[0].total).toBe(30);

    const many = Array.from({ length: 1000 }, () => ({ due_date: "2026-11-05", amount: 224.75 }));
    expect(totalsByQuincena(many)[0].total).toBe(22475000);
  });

  it("returns an empty list for no rows", () => {
    expect(totalsByQuincena([])).toEqual([]);
  });
});

describe("splitPurchase", () => {
  const nov1 = quincenaOf("2026-11-15");

  it("$899 in 4 → 224.75 × 4 over consecutive quincenas", () => {
    const parts = splitPurchase(899, 4, nov1);
    expect(parts.map((p) => p.amount)).toEqual([22475, 22475, 22475, 22475]);
    expect(parts.map((p) => p.quincena.payday)).toEqual([
      "2026-11-15",
      "2026-11-30",
      "2026-12-15",
      "2026-12-31",
    ]);
  });

  it("$1000 in 3 → 333.33, 333.33, 333.34 (remainder on the last)", () => {
    expect(splitPurchase(1000, 3, nov1).map((p) => p.amount)).toEqual([33333, 33333, 33334]);
  });

  it("installments always add up to the exact amount", () => {
    for (const [amount, n] of [
      [100000, 7],
      [1, 24],
      [0.05, 3],
      [2490.5, 6],
    ] as const) {
      const parts = splitPurchase(amount, n, nov1);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(toCents(amount));
      for (const p of parts) expect(Number.isInteger(p.amount)).toBe(true);
    }
  });

  it("crosses the year boundary", () => {
    const parts = splitPurchase(300, 3, quincenaOf("2026-12-20"));
    expect(parts.map((p) => p.quincena.payday)).toEqual(["2026-12-31", "2027-01-15", "2027-01-31"]);
  });

  it.each([
    [899, 0],
    [899, 2.5],
    [0, 4],
    [-10, 4],
    [10.001, 2],
    [Number.NaN, 2],
  ])("rejects amount=%s n=%s", (amount, n) => {
    expect(() => splitPurchase(amount, n, nov1)).toThrow();
  });
});

describe("prePurchaseImpact", () => {
  it("$899 in 4 from Nov 15 adds $224.75 on top of what is already owed", () => {
    const impact = prePurchaseImpact(ROWS, 899, 4, quincenaOf("2026-11-15"));
    expect(impact.map(({ quincena, ...rest }) => ({ payday: quincena.payday, ...rest }))).toEqual([
      { payday: "2026-11-15", added: 22475, alreadyOwed: 249050, newTotal: 271525 },
      { payday: "2026-11-30", added: 22475, alreadyOwed: 214150, newTotal: 236625 },
      { payday: "2026-12-15", added: 22475, alreadyOwed: 214150, newTotal: 236625 },
      { payday: "2026-12-31", added: 22475, alreadyOwed: 34900, newTotal: 57375 },
    ]);
  });

  it("reports zero already owed for quincenas with no debt", () => {
    const [only] = prePurchaseImpact([], 500, 1, quincenaOf("2027-06-01"));
    expect(only).toMatchObject({ added: 50000, alreadyOwed: 0, newTotal: 50000 });
  });
});

describe("toCents / formatMXN", () => {
  it.each([
    [2490.5, 249050],
    [224.75, 22475],
    [249, 24900],
    [0.07, 7],
  ])("toCents(%s) = %i", (pesos, cents) => {
    expect(toCents(pesos)).toBe(cents);
  });

  it("rejects sub-cent precision", () => {
    expect(() => toCents(1.005)).toThrow();
  });

  it.each([
    [249050, "$2,490.50"],
    [271525, "$2,715.25"],
    [22475, "$224.75"],
    [5, "$0.05"],
    [0, "$0.00"],
    [10000000, "$100,000.00"],
    [123456789, "$1,234,567.89"],
  ])("formatMXN(%i) = %s", (cents, text) => {
    expect(formatMXN(cents)).toBe(text);
  });
});
