import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ScanFlow } from "@/components/ScanFlow";
import { getUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { supabase, user } = await getUser();
  if (!supabase || !user) redirect("/");

  // RLS limits this to the user's own rows; no user_id filter needed (or trusted).
  const { count, error } = await supabase
    .from("installments")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <AppHeader email={user.email} />
      <main className="flex flex-1 flex-col gap-5 pt-6">
        <h1 className="text-3xl font-extrabold text-ink">Tus quincenas</h1>
        {error ? (
          <p role="alert" className="rounded-xl bg-coral-soft p-4 text-base text-ink">
            No pudimos leer tus pagos. Intenta otra vez en un momento.
          </p>
        ) : count ? (
          <p className="text-lg">
            Tienes {count === 1 ? "1 pago guardado" : `${count} pagos guardados`}.
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-lg font-semibold">Aún no tienes pagos guardados.</p>
            <p className="mt-2 text-base text-muted">
              Cuando subas la captura de tu calendario de pagos, aquí verás cuánto debes en cada quincena.
            </p>
          </div>
        )}
        <ScanFlow />
      </main>
    </>
  );
}
