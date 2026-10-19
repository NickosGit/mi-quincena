import Link from "next/link";

import { hasSupabaseEnv } from "@/lib/supabase/env";

import { DemoFlow } from "./DemoFlow";

export const metadata = { title: "Mi Quincena · Prueba con datos ficticios" };

export default function DemoPage() {
  return (
    <>
      <div
        role="status"
        className="sticky top-0 z-10 -mx-4 bg-ink px-4 py-3 text-center text-base font-bold text-white"
      >
        Datos ficticios — no se guarda nada
      </div>
      <main className="flex flex-1 flex-col gap-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold text-ink">Prueba Mi Quincena</h1>
          <Link href="/" className="flex min-h-12 items-center rounded-xl border border-line bg-card px-4 text-base font-semibold">
            Inicio
          </Link>
        </div>
        <p className="text-lg">
          Usa una de nuestras capturas de ejemplo (calendarios inventados, sin marca) o sube la tuya. Nada se guarda.
        </p>
        <DemoFlow canSignIn={hasSupabaseEnv} />
      </main>
    </>
  );
}
