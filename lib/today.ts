/** Today's date ("YYYY-MM-DD") in Mexico City. Servers (Vercel) run in UTC. */
export function todayInMexico(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}
