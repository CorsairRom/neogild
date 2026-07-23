import { requireOnboarded } from "@/lib/auth/session";
import { AppNav } from "@/components/app-nav";
import { SyncButton } from "@/components/gmail-sync";

export const dynamic = "force-dynamic";

function formatCLP(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    promoted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    discarded: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-100"}`}
    >
      {status}
    </span>
  );
}

export default async function InboxPage() {
  const { supabase } = await requireOnboarded();

  const { data: movements } = await supabase
    .from("email_movements")
    .select("*")
    .order("email_date", { ascending: false })
    .limit(50);

  const pending = movements?.filter((m) => m.status === "pending").length ?? 0;
  const errors = movements?.filter((m) => m.status === "error").length ?? 0;
  const promoted = movements?.filter((m) => m.status === "promoted").length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <AppNav />
        <h1 className="text-2xl font-semibold">Correos bancarios</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Staging de ingesta: {pending} pendientes, {errors} con error
          {promoted > 0 ? `, ${promoted} promovidos` : ""}.
          {errors > 0 && (
            <>
              {" "}
              Si ves «no account matches hint», revisa los últimos 4 dígitos en{" "}
              <a href="/settings/accounts" className="underline">
                Cuentas
              </a>
              .
            </>
          )}
        </p>
        <SyncButton />
      </header>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Fuente</th>
              <th className="px-3 py-2 font-medium">Merchant</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(movements ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  Sin correos aún. Conecta IMAP en Configuración y ejecuta sync.
                </td>
              </tr>
            ) : (
              movements!.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">{statusBadge(m.status)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {m.email_date
                      ? new Date(m.email_date).toLocaleDateString("es-CL")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.source}</td>
                  <td className="px-3 py-2">{m.merchant ?? m.counterparty ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {m.currency === "USD" && m.amount != null
                      ? `US$${(m.amount / 100).toFixed(2)}`
                      : formatCLP(m.amount)}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-zinc-500">
                    {m.status === "error" && m.error_detail ? (
                      <span className="text-red-600 dark:text-red-400">{m.error_detail}</span>
                    ) : (
                      m.raw_snippet?.slice(0, 80) ?? "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
