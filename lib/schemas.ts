import { z } from "zod";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Checked in the browser before OCR. The file itself never leaves the device. */
export const uploadSchema = z.object({
  type: z.enum(UPLOAD_TYPES, { message: "Sube una captura en PNG, JPG o WEBP." }),
  size: z
    .number()
    .positive({ message: "El archivo está vacío." })
    .max(MAX_UPLOAD_BYTES, { message: "La imagen pesa más de 8 MB. Usa una captura de pantalla." }),
});
