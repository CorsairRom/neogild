import Link from "next/link";
import {
  BankIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  UploadSimpleIcon,
  WalletIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Amount } from "@/components/privacy-provider";
import { formatCLP } from "@/lib/format";
import {
  getAccountMonthActivity,
  getPersonalAccountBalances,
  parseMonthParam,
} from "@neogild/core";

export const dynamic = "force-dynamic";

const ACCOUNT_ICONS: Record<string, typeof BankIcon> = {
  debit: BankIcon,
  credit_card: CreditCardIcon,
  cash: WalletIcon,
};

function subtypeLabel(subtype: string) {
  switch (subtype) {
    case "debit":
      return "Cuenta corriente";
    case "credit_card":
      return "Tarjeta de crédito";
    case "cash":
      return "Efectivo";
    default:
      return subtype;
  }
}

function accountHint(metadata: Record<string, unknown> | null) {
  const last4 = (metadata as { card_last4?: string } | null)?.card_last4;
  if (last4) return `····${last4}`;
  const accountNumbers = (metadata as { bank_account_numbers?: string[] } | null)
    ?.bank_account_numbers;
  if (accountNumbers?.[0]) return `····${accountNumbers[0].slice(-4)}`;
  return null;
}

function reconciliationStatus(balance: number, lastStatementBalance: number | null, lastStatementDate: string | null) {
  if (lastStatementBalance === null) {
    return { label: "Sin cartola cargada este mes", color: "var(--muted)", Icon: ClockIcon };
  }
  if (balance === lastStatementBalance) {
    return {
      label: `Cuadra con la cartola al ${lastStatementDate}`,
      color: "var(--pos)",
      Icon: CheckCircleIcon,
    };
  }
  return {
    label: `Diferencia de ${formatCLP(balance - lastStatementBalance, { signed: true })} con la cartola`,
    color: "var(--warn)",
    Icon: WarningIcon,
  };
}

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
    <AppShell userEmail={user.email ?? ""} title="Cuentas">
      <div className="flex flex-col gap-5">
        <div className="ng-hero ng-rise flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="m-0 text-[11px] tracking-[0.1em] text-accent-strong uppercase">
              Suma de tus cuentas
            </p>
            <p className="mt-2 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">
              <Amount>{formatCLP(totalBalance, { signed: true })}</Amount>
            </p>
          </div>
          <Link href="/accounts/upload" className="ng-btn ng-btn-primary">
            <UploadSimpleIcon size={16} />
            Cargar cartola
          </Link>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {accounts.map((account) => {
            const act = activity.find((a) => a.account_id === account.id);
            const Icon = ACCOUNT_ICONS[account.subtype] ?? BankIcon;
            const hint = accountHint(account.metadata);
            const recon = reconciliationStatus(
              account.balance,
              account.last_statement_balance,
              account.last_statement_date,
            );
            return (
              <Link
                key={account.id}
                href={`/accounts/${account.id}?month=${month}`}
                className="ng-card ng-card-hover-accent ng-rise flex flex-col gap-4 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-[38px] flex-none place-items-center rounded-[10px] bg-accent-soft text-accent-strong">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{account.name}</span>
                    <span className="block text-xs text-faint">
                      {subtypeLabel(account.subtype)}
                      {hint ? ` · ${hint}` : ""}
                    </span>
                  </span>
                </div>
                <p
                  className="m-0 text-[28px] font-semibold tracking-[-0.02em] tabular-nums"
                  style={account.balance < 0 ? { color: "var(--neg)" } : undefined}
                >
                  <Amount>{formatCLP(account.balance, { signed: true })}</Amount>
                </p>
                {act && (
                  <div className="flex gap-5">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-faint">Entró</span>
                      <span className="text-[13px] tabular-nums" style={{ color: "var(--pos)" }}>
                        <Amount>{formatCLP(act.income)}</Amount>
                      </span>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-faint">Salió</span>
                      <span className="text-[13px] tabular-nums" style={{ color: "var(--neg)" }}>
                        <Amount>{formatCLP(act.expense)}</Amount>
                      </span>
                    </span>
                  </div>
                )}
                <div
                  className="flex items-center gap-2 rounded-[9px] bg-surface-2 px-3 py-2.5 text-xs"
                  style={{ color: recon.color }}
                >
                  <recon.Icon size={15} />
                  {recon.label}
                </div>
              </Link>
            );
          })}
        </div>

        <p className="m-0 max-w-[680px] text-[13px] leading-[1.6] text-muted">
          Las transferencias entre tus propias cuentas no cuentan como ingreso ni gasto del mes:
          acá ves cuánto hay en cada banco y cómo se mueve entre ellos.
        </p>
      </div>
    </AppShell>
  );
}
