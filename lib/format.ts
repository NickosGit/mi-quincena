// Spanish (Mexico) display helpers. Dates are ISO strings; nothing here touches money math.

import type { Quincena } from "./quincena";

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-01" → "1 nov 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** → "1ª quincena de noviembre 2026" */
export function quincenaLabel(q: Quincena): string {
  return `${q.half === 1 ? "1ª" : "2ª"} quincena de ${MONTHS_LONG[q.month - 1]} ${q.year}`;
}

/** → "15 de nov" (the payday, as used in "tu quincena del 15 de nov") */
export function paydayLabel(q: Quincena): string {
  const day = Number(q.payday.slice(8, 10));
  return `${day} de ${MONTHS_SHORT[q.month - 1]}`;
}
