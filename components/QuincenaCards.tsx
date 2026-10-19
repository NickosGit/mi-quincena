import { AiTag } from "@/components/AiTag";
import { formatDate, quincenaLabel } from "@/lib/format";
import { formatMXN, toCents } from "@/lib/quincena";
import type { QuincenaCard } from "@/lib/review";

/** Upcoming quincenas, earliest first. Tap a card to see its payments. */
export function QuincenaCards({ cards }: { cards: QuincenaCard[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Tus próximas quincenas">
      {cards.map((card, i) => (
        <li key={card.quincena.payday}>
          <details className="group rounded-2xl border border-line bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none flex-col gap-1 p-4">
              <span className="text-base text-muted">{quincenaLabel(card.quincena)}</span>
              <span className={`font-extrabold text-ink ${i === 0 ? "text-3xl" : "text-2xl"}`}>
                Ya debes {formatMXN(card.total)}
              </span>
              <span className="flex items-center justify-between text-base text-muted">
                {card.plans === 1 ? "1 plan" : `${card.plans} planes`}
                <span className="text-base group-open:hidden">Ver pagos ▾</span>
                <span className="hidden text-base group-open:inline">Ocultar ▴</span>
              </span>
            </summary>
            <ul className="flex flex-col gap-2 border-t border-line p-4">
              {card.rows.map((row, j) => (
                <li key={j} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-base">
                    <span>
                      {formatDate(row.due_date)} · {row.label}
                    </span>
                    <span className="font-bold">{formatMXN(toCents(row.amount))}</span>
                  </div>
                  <AiTag />
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
