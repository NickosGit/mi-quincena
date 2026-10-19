import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const geminiRows = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser: () => getUser() }));
vi.mock("@/lib/gemini", () => ({ geminiRows: (...a: unknown[]) => geminiRows(...a) }));

const CLEAN = readFileSync(path.join(import.meta.dirname, "..", "fixtures", "clean.txt"), "utf8");

async function loadRoute() {
  vi.resetModules(); // fresh rate limiter per test
  return (await import("@/app/api/extract/route")).POST;
}

const post = (POST: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ user: { id: "user-a" } });
  geminiRows.mockReset().mockResolvedValue(null);
});

describe("POST /api/extract", () => {
  it("returns rows for a signed-in user", async () => {
    const res = await post(await loadRoute(), { text: CLEAN });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ source: "regex", fallback: "no_llm", check: { status: "complete" } });
    expect(json.rows).toHaveLength(12);
  });

  it("401 without a session", async () => {
    getUser.mockResolvedValue({ user: null });
    const res = await post(await loadRoute(), { text: CLEAN });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Inicia sesión para leer tu captura." });
  });

  it("demo: true works without a session", async () => {
    getUser.mockResolvedValue({ user: null });
    const res = await post(await loadRoute(), { text: CLEAN, demo: true });
    expect(res.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{text: 1nov", "La solicitud no es válida."],
    ["empty text", { text: "   " }, "No llegó texto de la captura."],
    ["text over 4,000 chars", { text: "x".repeat(4001) }, "El texto de la captura es demasiado largo (máximo 4,000 caracteres)."],
    ["text not a string", { text: 123 }, "Falta el texto de la captura."],
    ["missing text", { demo: true }, "Falta el texto de la captura."],
    ["unknown field", { text: "1 nov $1.00", image: "data:..." }, "La solicitud no es válida."],
    ["demo not boolean", { text: "1 nov $1.00", demo: "yes" }, "La solicitud no es válida."],
    ["body over 20 KB", JSON.stringify({ text: "x".repeat(25_000) }), "La solicitud es demasiado grande."],
  ])("400 on %s, with a Spanish message and no stack", async (_, body, message) => {
    const res = await post(await loadRoute(), body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: message });
  });

  it("429 after 20 calls in 10 minutes for the same user", async () => {
    const POST = await loadRoute();
    for (let i = 0; i < 20; i++) expect((await post(POST, { text: "1 nov $1.00" })).status).toBe(200);
    const res = await post(POST, { text: "1 nov $1.00" });
    expect(res.status).toBe(429);
    // Another user is unaffected.
    getUser.mockResolvedValue({ user: { id: "user-b" } });
    expect((await post(POST, { text: "1 nov $1.00" })).status).toBe(200);
  });

  it("500 with a generic Spanish message when something unexpected breaks", async () => {
    getUser.mockRejectedValue(new Error("db exploded at /var/task/secret.js:12"));
    const res = await post(await loadRoute(), { text: CLEAN });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "Algo falló al leer tu captura. Intenta otra vez." });
    expect(text).not.toMatch(/exploded|secret|at \//);
  });

  it("an LLM failure is a labeled fallback, not an error", async () => {
    geminiRows.mockRejectedValue(new Error("Gemini HTTP 503"));
    const res = await post(await loadRoute(), { text: CLEAN });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ source: "regex", fallback: "llm_error" });
  });
});
