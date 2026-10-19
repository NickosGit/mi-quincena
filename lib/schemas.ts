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

const isoDate = z
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
