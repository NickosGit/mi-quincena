import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { defaultStart, impactLines, startOptions } from "@/lib/prepurchase";
import { regexRows } from "@/lib/parse";
import { quincenaOf, totalsByQuincena } from "@/lib/quincena";
import { checkReview, parseAmountInput, toDraft, upcomingCards, type DraftRow, type SavedInstallment } from "@/lib/review";
import { addMonthsIso, prePurchaseSchema } from "@/lib/schemas";

const TODAY = "2026-10-18";
const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "..", "fixtures", name), "utf8");
const EXPECTED: { rows: { due_date: string; amount: number }[] } = JSON.parse(fixture("expected.json"));

const draft = (due_date: string, amount: string): DraftRow => ({ due_date, amount, source_line: "" });
const save = (rows: DraftRow[], label = "Mis pagos") => {
  const r = checkReview(rows, label, TODAY);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.installments;
};
const CLEAN_SAVED = save(toDraft(regexRows(fixture("clean.txt"), TODAY)));

describe("checkReview (Guardar)", () => {
  it("accepts the clean fixture as-is", () => {
    expect(CLEAN_SAVED).toHaveLength(12);
    expect(CLEAN_SAVED[0]).toEqual({ due_date: "2026-11-01", amount: 349, label: "Mis pagos" });
  });

  it("blocks saving while any row is incomplete, and says why", () => {
    const r = checkReview([draft("2026-11-01", "349.00"), draft("", "892.50"), draft("2026-11-20", "")], "Tenis", TODAY);
    expect(r).toMatchObject({ ok: false, rowErrors: [null, "Falta la fecha.", "Falta el monto."], labelError: null });
  });

  it("blurred fixture, after filling the missing dates, gives the same totals as the clean one", () => {
    // What Gemini returned live: 12 amounts, every date null.
    const blurred = toDraft(EXPECTED.rows.map((r) => ({ due_date: null, amount: r.amount, source_line: "" })));
    expect(checkReview(blurred, "Mis pagos", TODAY).ok).toBe(false);
    const filled = blurred.map((row, i) => ({ ...row, due_date: EXPECTED.rows[i].due_date }));
    expect(totalsByQuincena(save(filled))).toEqual(totalsByQuincena(CLEAN_SAVED));
    expect(totalsByQuincena(save(filled))[0].total).toBe(249050);
  });

  it.each([
    ["", "Ponle un nombre al plan, por ejemplo Celular."],
    ["   ", "Ponle un nombre al plan, por ejemplo Celular."],
    ["x".repeat(41), "El nombre del plan puede tener hasta 40 letras."],
  ])("rejects label %j", (label, message) => {
    expect(checkReview([draft("2026-11-01", "1")], label, TODAY)).toMatchObject({ ok: false, labelError: message });
  });

  it("counts a 40-letter label with accents and emoji as 40, like Postgres char_length", () => {
    const label = "Súper 🛒" + "ñ".repeat(40 - [..."Súper 🛒"].length);
    expect(label.length).toBe(41); // UTF-16 length overcounts the emoji
    expect([...label]).toHaveLength(40);
    expect(checkReview([draft("2026-11-01", "1")], label, TODAY).ok).toBe(true);
  });

  it.each([
    ["0", "El monto debe ser mayor a $0."],
    ["-5", "Escribe el monto como 1249.50."],
    ["100000.01", "El monto máximo es $100,000."],
    ["12.345", "Escribe el monto como 1249.50."],
    ["abc", "Escribe el monto como 1249.50."],
  ])("rejects amount %j", (amount, message) => {
    expect(checkReview([draft("2026-11-01", amount)], "Tenis", TODAY)).toMatchObject({ ok: false, rowErrors: [message] });
  });

  it("enforces the packet's date window: −1 / +24 months", () => {
    expect(checkReview([draft("2026-09-18", "1")], "x", TODAY).ok).toBe(true);
    expect(checkReview([draft("2026-09-17", "1")], "x", TODAY)).toMatchObject({ rowErrors: ["Esa fecha ya pasó hace más de un mes."] });
    expect(checkReview([draft("2028-10-18", "1")], "x", TODAY).ok).toBe(true);
    expect(checkReview([draft("2028-10-19", "1")], "x", TODAY)).toMatchObject({ rowErrors: ["Esa fecha está a más de 24 meses."] });
  });

  it("refuses to save nothing", () => {
    expect(checkReview([], "Tenis", TODAY)).toMatchObject({ ok: false, formError: "No hay pagos para guardar." });
  });

  it.each([
    ["1,249.50", 1249.5],
    ["$ 899", 899],
    ["224.75", 224.75],
    ["224.7", 224.7],
    ["", null],
    ["1.249,50", null],
  ])("parseAmountInput(%j) = %s", (input, out) => {
    expect(parseAmountInput(input)).toBe(out);
  });

  it("addMonthsIso clamps to the end of the month", () => {
    expect(addMonthsIso("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-10-18", 24)).toBe("2028-10-18");
    expect(addMonthsIso("2027-01-15", -1)).toBe("2026-12-15");
  });
});

describe("upcomingCards (dashboard)", () => {
  it("totals match totalsByQuincena for the same rows", () => {
    const cards = upcomingCards(CLEAN_SAVED, TODAY);
    expect(cards.map((c) => [c.quincena.payday, c.total])).toEqual(
      totalsByQuincena(CLEAN_SAVED).map((t) => [t.quincena.payday, t.total]),
    );
  });

  it("counts distinct plans per quincena", () => {
    const rows: SavedInstallment[] = [
      { due_date: "2026-11-01", amount: 349, label: "Súper" },
      { due_date: "2026-11-05", amount: 1249, label: "Celular" },
      { due_date: "2026-11-12", amount: 892.5, label: "Tenis" },
      { due_date: "2026-11-14", amount: 10, label: "Tenis" },
    ];
    expect(upcomingCards(rows, TODAY)[0]).toMatchObject({ total: 250050, plans: 3 });
  });

  it("hides past quincenas but keeps the current one", () => {
    const rows: SavedInstallment[] = [
      { due_date: "2026-10-10", amount: 1, label: "a" }, // 1st Oct quincena: past
      { due_date: "2026-10-20", amount: 2, label: "a" }, // 2nd Oct: current
      { due_date: "2026-11-02", amount: 3, label: "a" },
    ];
    expect(upcomingCards(rows, TODAY).map((c) => c.quincena.payday)).toEqual(["2026-10-31", "2026-11-15"]);
  });
});

describe("pre-purchase (F6)", () => {
  it("$899 in 4 quincenas from Nov 15 with the clean data: +$224.75 each, correct totals", () => {
    const lines = impactLines(CLEAN_SAVED, 899, 4, quincenaOf("2026-11-15"));
    expect(lines.map((l) => l.sentence)).toEqual([
      "Esto suma $224.75 a tu quincena del 15 de nov. Ya debes $2,490.50. Total: $2,715.25.",
      "Esto suma $224.75 a tu quincena del 30 de nov. Ya debes $2,141.50. Total: $2,366.25.",
      "Esto suma $224.75 a tu quincena del 15 de dic. Ya debes $2,490.50. Total: $2,715.25.",
      "Esto suma $224.75 a tu quincena del 31 de dic. Ya debes $2,141.50. Total: $2,366.25.",
    ]);
  });

  it("default first payment is the next quincena (Nov 15 on Oct 18)", () => {
    expect(defaultStart(TODAY).payday).toBe("2026-11-15");
    expect(startOptions(TODAY)[0].label).toBe("2ª quincena de octubre 2026 (paga el 31 de oct)");
    expect(startOptions(TODAY)).toHaveLength(25);
  });

  it("with the optional pay, says what would be left, as plain numbers", () => {
    const [first] = impactLines(CLEAN_SAVED, 899, 4, quincenaOf("2026-11-15"), 6000);
    expect(first.left).toBe("Te quedarían $3,284.75.");
    const [short] = impactLines(CLEAN_SAVED, 899, 4, quincenaOf("2026-11-15"), 2000);
    expect(short.left).toBe("Te faltarían $715.25.");
  });

  it.each([
    [{ amount: 899, n: 4 }, true],
    [{ amount: 1, n: 1 }, true],
    [{ amount: 100000, n: 24 }, true],
    [{ amount: 0.5, n: 4 }, false],
    [{ amount: 100001, n: 4 }, false],
    [{ amount: 899, n: 0 }, false],
    [{ amount: 899, n: 25 }, false],
    [{ amount: 899, n: 2.5 }, false],
    [{ amount: 899.999, n: 2 }, false],
  ])("validates %j → %s", (input, ok) => {
    expect(prePurchaseSchema.safeParse(input).success).toBe(ok);
  });
});
