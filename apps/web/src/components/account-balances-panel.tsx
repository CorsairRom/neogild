import Link from "next/link";
import { formatCLP } from "@/lib/format";
import type { AccountBalanceRow, AccountMonthActivity } from "@neogild/core";

function subtypeLabel(subtype: string) {
  switch (subtype) {
    case "debit":
      return "Cuenta";
    case "credit_card":
      return "Tarjeta";
    case "cash":
      return "Efectivo";
    default:
      return subtype;
  }
}

export function AccountBalancesPanel({
  accounts,
  activity,
  totalBalance,
}: {
  accounts: AccountBalanceRow[];
  activity: AccountMonthActivity[];
  totalBalance: number;
}) {
  const activityMap = new Map(activity.map((a) => [a.account_id, a]));

  if (accounts.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Mis cuentas</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Saldo por cuenta · movimientos internos no afectan tus ingresos del mes
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Total en cuentas</p>
          <p className="text-lg font-semibold tabular-nums">{formatCLP(totalBalance, { signed: true })}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {accounts.map((account) => {
          const act = activityMap.get(account.id);
          return (
            <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <Link
                  href={`/accounts/${account.id}`}
                  className="font-medium hover:underline"
                >
                  {account.name}
                </Link>
                <p className="text-xs text-zinc-500">{subtypeLabel(account.subtype)}</p>
              </div>
              <div className="flex flex-wrap items-end gap-4 text-sm">
                {act && (act.transfer_in > 0 || act.transfer_out > 0) && (
                  <div className="text-xs text-zinc-500">
                    {act.transfer_in > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatCLP(act.transfer_in)} transf.
                      </span>
                    )}
                    {act.transfer_in > 0 && act.transfer_out > 0 && " · "}
                    {act.transfer_out > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        −{formatCLP(act.transfer_out)} transf.
                      </span>
                    )}
                  </div>
                )}
                <p
                  className={`font-semibold tabular-nums ${
                    account.balance < 0 ? "text-rose-600 dark:text-rose-400" : ""
                  }`}
                >
                  {formatCLP(account.balance, { signed: true })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <Link href="/accounts" className="mt-3 inline-block text-xs text-zinc-500 underline">
        Ver detalle por cuenta
      </Link>
    </section>
  );
}
