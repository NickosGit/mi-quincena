import { extractRows } from "@/lib/extract";
import { geminiRows } from "@/lib/gemini";
import { createRateLimiter } from "@/lib/rate-limit";
import { extractBodySchema } from "@/lib/schemas";
import { getUser } from "@/lib/supabase/server";

const MAX_BODY_CHARS = 20_000;
const allow = createRateLimiter(20, 10 * 60 * 1000);

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Today's date in Mexico City (Vercel functions run in UTC). */
function todayInMexico(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

/** POST { text, demo? } → { rows, source, check, fallback? }. OCR text in, never an image. */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return fail(400, "La solicitud es demasiado grande.");

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail(400, "La solicitud no es válida.");
    }

    const body = extractBodySchema.safeParse(json);
    if (!body.success) {
      const issue = body.error.issues[0];
      return fail(400, issue.path[0] === "text" ? issue.message : "La solicitud no es válida.");
    }

    let key: string;
    if (body.data.demo) {
      // Demo mode works without a session (F7) and never saves anything.
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      key = `demo:${ip}`;
    } else {
      const { user } = await getUser();
      if (!user) return fail(401, "Inicia sesión para leer tu captura.");
      key = `user:${user.id}`;
    }

    if (!allow(key)) return fail(429, "Hiciste muchas lecturas seguidas. Espera unos minutos e intenta otra vez.");

    const result = await extractRows(body.data.text, todayInMexico(), geminiRows);
    return Response.json(result);
  } catch {
    // Never leak stack traces or the OCR text.
    return fail(500, "Algo falló al leer tu captura. Intenta otra vez.");
  }
}
