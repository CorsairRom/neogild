import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { getEmailConnectionStatus } from "@/lib/email/credentials";
import { AppNav } from "@/components/app-nav";
import { SyncButton } from "@/components/gmail-sync";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { supabase, user } = await requireOnboarded();
  const connection = await getEmailConnectionStatus(user.id);

  const { count: txCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await supabase
    .from("email_movements")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: errorCount } = await supabase
    .from("email_movements")
    .select("*", { count: "exact", head: true })
    .eq("status", "error");

  const { data: syncState } = await supabase
    .from("sync_state")
    .select("gmail_watermark, updated_at")
    .maybeSingle();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <header className="space-y-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
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
        </div>
        <AppNav />
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Transacciones" value={txCount ?? 0} />
        <StatCard label="Correos pendientes" value={pendingCount ?? 0} />
        <StatCard label="Errores de parseo" value={errorCount ?? 0} />
      </section>

      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-2 font-medium">Sync correos</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {connection.connected
            ? `Conectado${connection.email ? `: ${connection.email}` : ""}. Último watermark: ${syncState?.gmail_watermark ? new Date(syncState.gmail_watermark).toLocaleString("es-CL") : "nunca"}.`
            : "Conecta IMAP en Configuración."}
        </p>
        {connection.connected ? (
          <div className="flex flex-wrap gap-3">
            <SyncButton />
            <Link href="/inbox" className="text-sm underline text-zinc-600">
              Ver correos →
            </Link>
          </div>
        ) : (
          <Link href="/settings" className="text-sm underline">
            Ir a configuración de correo
          </Link>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">Checklist F1</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Cuentas con ****1234 o número de cuenta configuradas</li>
          <li>Correo IMAP conectado (App Password)</li>
          <li>Sync → transacciones visibles arriba</li>
          <li>Reenvíos históricos → inbox sin duplicar</li>
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
