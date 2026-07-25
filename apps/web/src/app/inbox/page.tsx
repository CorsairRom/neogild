import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
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
    pending_attachment: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    promoted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    discarded: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const labels: Record<string, string> = {
    pending_attachment: "cartola",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-100"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default async function InboxPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: profile } = await supabase
    .from("profiles")
    .select("rut")
    .eq("id", user.id)
    .single();

  const hasRut = Boolean(profile?.rut);

  const { data: movements } = await supabase
    .from("email_movements")
    .select("*")
    .order("email_date", { ascending: false })
    .limit(50);

  const pending = movements?.filter((m) => m.status === "pending").length ?? 0;
  const cartolas =
    movements?.filter((m) => m.status === "pending_attachment").length ?? 0;
  const errors = movements?.filter((m) => m.status === "error").length ?? 0;
  const promoted = movements?.filter((m) => m.status === "promoted").length ?? 0;

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Correos bancarios"
      description={`Staging: ${pending} pendientes${cartolas > 0 ? `, ${cartolas} cartolas` : ""}, ${errors} errores${promoted > 0 ? `, ${promoted} promovidos` : ""}.`}
    >
      <SyncButton />

      {cartolas > 0 && (
        <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
          {hasRut ? (
            <>
              Las cartolas CuentaRUT están encriptadas; se abren con los últimos 4 dígitos
              de tu RUT (guardado en{" "}
              <Link href="/settings" className="font-medium underline">
                Configuración
              </Link>
              ).
            </>
          ) : (
            <>
              Para abrir cartolas BancoEstado, configurá tu{" "}
              <Link href="/settings" className="font-medium underline">
                RUT en Configuración
              </Link>{" "}
              (contraseña del PDF = últimos 4 dígitos, sin dígito verificador).
            </>
          )}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(movements ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  Sin correos. Conectá IMAP y ejecutá sync desde el dashboard.
                </td>
              </tr>
            ) : (
              movements!.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="px-4 py-3">{statusBadge(m.status)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {m.email_date
                      ? new Date(m.email_date).toLocaleDateString("es-CL")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.source}</td>
                  <td className="max-w-[12rem] truncate px-4 py-3">
                    {m.merchant ?? m.counterparty ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCLP(m.amount)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-500">
                    {m.status === "error" && m.error_detail ? (
                      <span className="text-red-600 dark:text-red-400">{m.error_detail}</span>
                    ) : m.status === "pending_attachment" && m.attachment_path ? (
                      hasRut ? (
                        <Link
                          href={`/cartolas/${m.id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Ver cartola
                        </Link>
                      ) : (
                        <Link
                          href="/settings"
                          className="font-medium text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Configurar RUT
                        </Link>
                      )
                    ) : m.status === "pending_attachment" ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {m.error_detail ?? "Sin adjunto"}
                      </span>
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
    </AppShell>
  );
}
