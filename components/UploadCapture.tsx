"use client";

import { useRef, useState } from "react";

import { readImageText } from "@/lib/ocr";
import { uploadSchema } from "@/lib/schemas";

type Phase = { kind: "idle" } | { kind: "reading"; progress: number; preview: string } | { kind: "error"; message: string };

/**
 * Picks a screenshot, OCRs it in the browser and hands back only the text.
 * The image is never uploaded; its object URL is revoked and the input cleared
 * as soon as OCR finishes.
 */
export function UploadCapture({ onText }: { onText: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = uploadSchema.safeParse({ type: file.type, size: file.size });
    if (!check.success) {
      e.target.value = "";
      setPhase({ kind: "error", message: check.error.issues[0].message });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPhase({ kind: "reading", progress: 0, preview });
    try {
      const text = await readImageText(file, (progress) =>
        setPhase((p) => (p.kind === "reading" ? { ...p, progress } : p)),
      );
      setPhase({ kind: "idle" });
      onText(text);
    } catch {
      setPhase({ kind: "error", message: "No pudimos leer la imagen. Intenta con otra captura." });
    } finally {
      URL.revokeObjectURL(preview);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const reading = phase.kind === "reading";

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`flex min-h-14 cursor-pointer items-center justify-center rounded-2xl px-5 text-lg font-bold text-white ${
          reading ? "bg-ink/60" : "bg-coral"
        }`}
      >
        {reading ? "Leyendo tu captura…" : "Subir captura"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={reading}
          onChange={onChange}
          aria-describedby="upload-help"
        />
      </label>
      <p id="upload-help" className="text-base text-muted">
        Captura de pantalla de tu calendario de pagos (PNG, JPG o WEBP, hasta 8 MB). Se lee en tu
        teléfono y no se sube ni se guarda.
      </p>

      {reading && (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4" role="status">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded */}
          <img src={phase.preview} alt="" className="h-20 w-12 rounded-md object-cover object-top" />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-base font-semibold">Leyendo tu captura… {Math.round(phase.progress * 100)}%</p>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-ink transition-all" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {phase.kind === "error" && (
        <p role="alert" className="rounded-xl bg-coral-soft p-3 text-base text-ink">
          {phase.message}
        </p>
      )}
    </div>
  );
}
