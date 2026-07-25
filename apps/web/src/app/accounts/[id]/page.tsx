import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { formatCLP, typeLabel } from "@/lib/format";
import { getAccountMonthActivity, parseMonthParam } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const month = parseMonthParam(sp.month);
  const { supabase, user } = await requireOnboarded();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, subtype, balance, currency, last_statement_balance, last_statement_date")
    .eq("id", id)
    .single();

  if (!account) notFound();

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 1).toISOString().slice(0, 10);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, date, description, amount, type, category, transfer_to")
    .eq("account_id", id)
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .limit(100);

  const activity = (await getAccountMonthActivity(supabase, month)).find(
    (a) => a.account_id === id,
  );

  const accountNames = new Map<string, string>();
  if (transactions?.some((t) => t.transfer_to)) {
    const ids = [...new Set(transactions.map((t) => t.transfer_to).filter(Boolean))] as string[];
    const { data: peers } = await supabase.from("accounts").select("id, name").in("id", ids);
    for (const p of peers ?? []) accountNames.set(p.id, p.name);
  }

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title={account.name}
      description={`Saldo actual · movimientos de ${month}`}
      actions={
        <Link href="/accounts" className="text-sm text-zinc-500 hover:underline">
          ← Todas las cuentas
        </Link>
      }
    >
      <div className="mb-4">
        <Link
          href={`/accounts/upload?account=${id}`}
          className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cargar cartola PDF
        </Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Saldo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCLP(account.balance, { signed: true })}
          </p>
        </div>
        {activity && (
          <>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">Ingresos del mes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">
                {formatCLP(activity.income)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">Gastos del mes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-600">
                {formatCLP(activity.expense)}
              </p>
            </div>
          </>
        )}
      </section>

      {account.last_statement_balance !== null && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            account.balance === account.last_statement_balance
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
          }`}
        >
          {account.balance === account.last_statement_balance
            ? `Coincide con la cartola al ${account.last_statement_date}.`
            : `Diferencia vs. cartola al ${account.last_statement_date}: ${formatCLP(
                account.balance - account.last_statement_balance,
                { signed: true },
              )}.`}
        </p>
      )}

      {(activity?.transfer_in ?? 0) > 0 || (activity?.transfer_out ?? 0) > 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Transferencias del mes:{" "}
          {activity!.transfer_in > 0 && (
            <span className="text-emerald-600">+{formatCLP(activity!.transfer_in)} entrantes</span>
          )}
          {activity!.transfer_in > 0 && activity!.transfer_out > 0 && " · "}
          {activity!.transfer_out > 0 && (
            <span className="text-rose-600">−{formatCLP(activity!.transfer_out)} salientes</span>
          )}
        </p>
      ) : null}

      {(transactions ?? []).length === 0 ? (
        <div className="mt-6 rounded-xl border border-zinc-200 px-4 py-12 text-center text-zinc-500 dark:border-zinc-800">
          Sin movimientos este mes.
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 sm:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {transactions!.map((tx) => {
                  const signed =
                    tx.type === "expense"
                      ? -tx.amount
                      : tx.type === "transfer"
                        ? tx.amount
                        : tx.amount;
                  const peer =
                    tx.transfer_to && accountNames.get(tx.transfer_to)
                      ? accountNames.get(tx.transfer_to)
                      : null;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {new Date(tx.date).toLocaleDateString("es-CL")}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">
                        {tx.description ?? "—"}
                        {peer && (
                          <span className="ml-1 text-xs text-zinc-500">↔ {peer}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{typeLabel(tx.type)}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          signed > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : signed < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : ""
                        }`}
                      >
                        {formatCLP(signed, { signed: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 sm:hidden">
            {transactions!.map((tx) => {
              const signed =
                tx.type === "expense"
                  ? -tx.amount
                  : tx.type === "transfer"
                    ? tx.amount
                    : tx.amount;
              const peer =
                tx.transfer_to && accountNames.get(tx.transfer_to)
                  ? accountNames.get(tx.transfer_to)
                  : null;
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{new Date(tx.date).toLocaleDateString("es-CL")}</span>
                    <span>{typeLabel(tx.type)}</span>
                  </div>
                  <p className="mt-1 truncate font-medium">
                    {tx.description ?? "—"}
                    {peer && <span className="ml-1 text-xs text-zinc-500">↔ {peer}</span>}
                  </p>
                  <p
                    className={`mt-1 text-right font-semibold tabular-nums ${
                      signed > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : signed < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : ""
                    }`}
                  >
                    {formatCLP(signed, { signed: true })}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
