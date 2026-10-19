import { describe, expect, it } from "vitest";

import { isProtectedPath, safeNext } from "@/lib/routes";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/dashboard/", "/dashboard/x"])("%s requires a session", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });

  it.each(["/", "/auth/callback", "/dashboardx", "/api/extract"])("%s is public", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/dashboard?x=1")).toBe("/dashboard?x=1");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "dashboard"])(
    "falls back for %j",
    (next) => {
      expect(safeNext(next)).toBe("/dashboard");
    },
  );
});
