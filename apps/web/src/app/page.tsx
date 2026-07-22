import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { count: txCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await supabase
    .from("email_movements")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Neogild</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Salir
          </button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Transacciones" value={txCount ?? 0} />
        <StatCard label="Correos pendientes" value={pendingCount ?? 0} />
      </section>

      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-2 font-medium">Fase 0 — Fundación</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Stack listo: Supabase (schema Balance + extensiones Neogild), auth
          single-user, API health. Siguiente: ingesta Gmail (Fase 1).
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            <Link href="/api/health" className="underline">
              /api/health
            </Link>{" "}
            — estado DB
          </li>
          <li>Cartolas → Fase 4 (tabla statement_entries ya migrada)</li>
          <li>Dashboard completo → Fase 3</li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
