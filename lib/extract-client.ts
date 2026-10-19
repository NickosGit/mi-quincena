// Browser side of /api/extract. If the route can't answer, the regex reading runs
// locally, so the app never stalls; the screen labels which reader was used.

import type { ExtractSource } from "./extract";
import { regexRows, todayIso, type ParsedRow } from "./parse";

export interface ClientExtract {
  rows: ParsedRow[];
  source: ExtractSource;
  /** Spanish message to show when the server refused (e.g. rate limit). */
  notice?: string;
}

export async function requestRows(text: string, demo = false): Promise<ClientExtract> {
  const local = (notice?: string): ClientExtract => ({ rows: regexRows(text, todayIso()), source: "regex", notice });
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(demo ? { text, demo: true } : { text }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !Array.isArray(json.rows)) {
      return local(typeof json?.error === "string" ? json.error : undefined);
    }
    return { rows: json.rows as ParsedRow[], source: json.source === "llm" ? "llm" : "regex" };
  } catch {
    return local();
  }
}
