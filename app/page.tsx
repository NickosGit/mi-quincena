import Link from "next/link";

import { GoogleButton } from "@/components/GoogleButton";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  enlace: "No se pudo terminar de entrar. Intenta otra vez.",
  sin_codigo: "Google no regresó la información completa. Intenta otra vez.",
};

const STEPS = [
  "Sube la captura de tu calendario de pagos a meses.",
  "Revisa las fechas y montos que leímos.",
  "Ve cuánto debes en cada quincena, sumando todas tus apps.",
  "Antes de comprar algo, mira cuánto le suma a tu quincena.",
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const { user } = await getUser();

  return (
    <main className="flex flex-1 flex-col gap-6 pt-10">
      <h1 className="text-4xl font-extrabold text-ink">Mi Quincena</h1>
      <p className="text-xl">
        ¿Cuánto debes ya en tu próxima quincena? Aquí lo ves en un solo número, aunque tengas pagos en
        varias apps.
      </p>

      {error && (
        <p role="alert" className="rounded-xl bg-coral-soft p-3 text-base text-ink">
          {error}
        </p>
      )}

      {user ? (
        <Link
          href="/dashboard"
          className="flex min-h-14 items-center justify-center rounded-2xl bg-ink px-5 text-lg font-bold text-white"
        >
          Ver mis quincenas
        </Link>
      ) : hasSupabaseEnv ? (
        <GoogleButton />
      ) : (
        <p role="alert" className="rounded-xl bg-coral-soft p-3 text-base text-ink">
          Falta configurar Supabase en este despliegue.
        </p>
      )}

      <ol className="mt-2 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-lg">
            <span className="font-bold text-coral">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="text-base text-muted">
        Tú decides qué comprar. Mi Quincena solo te muestra la cuenta.
      </p>
    </main>
  );
}
