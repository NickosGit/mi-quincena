import { describe, expect, it } from "vitest";

import { formatDate, paydayLabel, quincenaLabel } from "@/lib/format";
import { quincenaOf } from "@/lib/quincena";
import { MAX_UPLOAD_BYTES, uploadSchema } from "@/lib/schemas";

describe("format", () => {
  it("formats dates and quincenas in Spanish", () => {
    expect(formatDate("2026-11-01")).toBe("1 nov 2026");
    expect(quincenaLabel(quincenaOf("2026-11-01"))).toBe("1ª quincena de noviembre 2026");
    expect(quincenaLabel(quincenaOf("2027-01-31"))).toBe("2ª quincena de enero 2027");
    expect(paydayLabel(quincenaOf("2026-11-03"))).toBe("15 de nov");
    expect(paydayLabel(quincenaOf("2028-02-20"))).toBe("29 de feb");
  });
});

describe("uploadSchema", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
    expect(uploadSchema.safeParse({ type, size: 1000 }).success).toBe(true);
  });

  it.each([
    [{ type: "image/heic", size: 1000 }, "PNG, JPG o WEBP"],
    [{ type: "application/pdf", size: 1000 }, "PNG, JPG o WEBP"],
    [{ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }, "8 MB"],
    [{ type: "image/png", size: 0 }, "vacío"],
  ])("rejects %j in Spanish", (input, message) => {
    const r = uploadSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(message);
  });
});
