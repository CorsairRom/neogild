import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export function AppShell({
  userEmail,
  title,
  description,
  children,
  actions,
}: {
  userEmail: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Neogild
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
              {description && (
                <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-zinc-500">{userEmail}</p>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <AppNav />
            {actions}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warn" | "positive";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-200/80 dark:border-amber-900/50"
      : tone === "positive"
        ? "border-emerald-200/80 dark:border-emerald-900/50"
        : "border-zinc-200 dark:border-zinc-800";

  const inner = (
    <div
      className={`rounded-xl border bg-zinc-50/50 p-4 dark:bg-zinc-900/30 ${toneClass} ${href ? "transition hover:border-zinc-400 dark:hover:border-zinc-600" : ""}`}
    >
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>
  return inner;
}
