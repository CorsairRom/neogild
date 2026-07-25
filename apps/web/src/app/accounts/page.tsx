import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { AccountBalancesPanel } from "@/components/account-balances-panel";
import { formatCLP } from "@/lib/format";
import {
  getAccountMonthActivity,
  getPersonalAccountBalances,
  parseMonthParam,
} from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.month);
  const { supabase, user } = await requireOnboarded();

  const [accounts, activity] = await Promise.all([
    getPersonalAccountBalances(supabase),
    getAccountMonthActivity(supabase, month),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Mis cuentas"
      description="Saldo actual por cuenta y transferencias entre tus bancos."
    >
      <AccountBalancesPanel
        accounts={accounts}
        activity={activity}
        totalBalance={totalBalance}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => {
          const act = activity.find((a) => a.account_id === account.id);
          return (
            <Link
              key={account.id}
              href={`/accounts/${account.id}?month=${month}`}
              className="rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <p className="font-medium">{account.name}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCLP(account.balance, { signed: true })}
              </p>
              {act && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <div>
                    <dt>Ingresos mes</dt>
                    <dd className="text-emerald-600">{formatCLP(act.income)}</dd>
                  </div>
                  <div>
                    <dt>Gastos mes</dt>
                    <dd className="text-rose-600">{formatCLP(act.expense)}</dd>
                  </div>
                  {act.transfer_in > 0 && (
                    <div>
                      <dt>Transf. entrantes</dt>
                      <dd>{formatCLP(act.transfer_in)}</dd>
                    </div>
                  )}
                  {act.transfer_out > 0 && (
                    <div>
                      <dt>Transf. salientes</dt>
                      <dd>{formatCLP(act.transfer_out)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        El dashboard principal muestra ingresos y gastos personales del mes (ej. sueldo).
        Acá ves cuánto hay en cada banco y cómo se mueve entre cuentas.
      </p>
    </AppShell>
  );
}
