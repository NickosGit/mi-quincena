import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { DeleteAll } from "@/components/DeleteAll";
import { PrePurchase } from "@/components/PrePurchase";
import { QuincenaCards } from "@/components/QuincenaCards";
import { ScanFlow } from "@/components/ScanFlow";
import { upcomingCards, type SavedInstallment } from "@/lib/review";
import { getUser } from "@/lib/supabase/server";
import { todayInMexico } from "@/lib/today";

export default async function DashboardPage() {
  const { supabase, user } = await getUser();
  if (!supabase || !user) redirect("/");

  // RLS limits this to the user's own rows; no user_id filter needed (or trusted).
  const { data, error } = await supabase
    .from("installments")
    .select("due_date, amount, label")
    .order("due_date", { ascending: true });

  const today = todayInMexico();
  const saved: SavedInstallment[] = (data ?? []).map((r) => ({
    due_date: r.due_date as string,
    amount: Number(r.amount),
    label: r.label as string,
  }));
  const cards = upcomingCards(saved, today);

  return (
    <>
      <AppHeader email={user.email} />
      <main className="flex flex-1 flex-col gap-6 pt-6">
        <h1 className="text-3xl font-extrabold text-ink">Tus quincenas</h1>

        {error ? (
          <p role="alert" className="rounded-xl bg-coral-soft p-4 text-base text-ink">
            No pudimos leer tus pagos. Intenta otra vez en un momento.
          </p>
        ) : cards.length > 0 ? (
          <QuincenaCards cards={cards} />
        ) : (
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-lg font-semibold">
              {saved.length > 0 ? "No tienes pagos en las próximas quincenas." : "Aún no tienes pagos guardados."}
            </p>
            <p className="mt-2 text-base text-muted">
              Sube la captura de tu calendario de pagos y aquí verás cuánto debes en cada quincena.
            </p>
          </div>
        )}

        <ScanFlow today={today} />

        <PrePurchase saved={saved} today={today} />

        {saved.length > 0 && <DeleteAll />}
      </main>
    </>
  );
}
