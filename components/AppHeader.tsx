import Link from "next/link";

export function AppHeader({ email }: { email?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line py-4">
      <Link href="/dashboard" className="text-xl font-extrabold text-ink">
        Mi Quincena
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        {email && <span className="max-w-40 truncate text-base text-muted">{email}</span>}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="min-h-12 rounded-xl border border-line bg-card px-4 text-base font-semibold"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
