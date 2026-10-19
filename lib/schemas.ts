import { z } from "zod";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** POST /api/extract body. */
export const extractBodySchema = z
  .object({
    text: z
      .string({ message: "Falta el texto de la captura." })
      .trim()
      .min(1, { message: "No llegó texto de la captura." })
      .max(4000, { message: "El texto de la captura es demasiado largo (máximo 4,000 caracteres)." }),
    demo: z.boolean().optional(),
  })
  .strict();

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  });

/** What the LLM must return. Anything else is discarded in favor of the regex reading. */
export const llmOutputSchema = z.object({
  rows: z
    .array(
      z.object({
        due_date: isoDate.nullable(),
        amount: z.number().finite().nonnegative().nullable(),
        source_line: z.string().max(400),
      }),
    )
    .max(100),
});

/** Checked in the browser before OCR. The file itself never leaves the device. */
export const uploadSchema = z.object({
  type: z.enum(UPLOAD_TYPES, { message: "Sube una captura en PNG, JPG o WEBP." }),
  size: z
    .number()
    .positive({ message: "El archivo está vacío." })
    .max(MAX_UPLOAD_BYTES, { message: "La imagen pesa más de 8 MB. Usa una captura de pantalla." }),
});

/** "YYYY-MM-DD" shifted by whole months, clamped to the month's last day. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const pesos = (min: number, tooLow: string) =>
  z
    .number({ message: "Escribe el monto." })
    .finite({ message: "Escribe el monto." })
    .min(min, { message: tooLow })
    .max(100000, { message: "El monto máximo es $100,000." })
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: "Usa máximo 2 decimales." });

export const planLabelSchema = z
  .string()
  .trim()
  .min(1, { message: "Ponle un nombre al plan, por ejemplo Celular." })
  .refine((s) => [...s].length <= 40, { message: "El nombre del plan puede tener hasta 40 letras." });

/** One installment as saved: packet §9 limits (amount 0.01–100,000; date within −1/+24 months). */
export function installmentSchema(today: string) {
  const min = addMonthsIso(today, -1);
  const max = addMonthsIso(today, 24);
  return z.object({
    due_date: isoDate
      .refine((d) => d >= min, { message: "Esa fecha ya pasó hace más de un mes." })
      .refine((d) => d <= max, { message: "Esa fecha está a más de 24 meses." }),
    amount: pesos(0.01, "El monto debe ser mayor a $0."),
    label: planLabelSchema,
  });
}

/** Pre-purchase check inputs (F6). */
export const prePurchaseSchema = z.object({
  amount: pesos(1, "El monto mínimo es $1."),
  n: z
    .number({ message: "Elige en cuántas quincenas." })
    .int({ message: "Usa un número entero de quincenas." })
    .min(1, { message: "Mínimo 1 quincena." })
    .max(24, { message: "Máximo 24 quincenas." }),
});
