import Link from "next/link";
import { Suspense } from "react";
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
import { MonthNav } from "@/components/dashboard/month-nav";
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

function accountHint(
  subtype: string,
  metadata: Record<string, unknown> | null,
) {
  const meta = metadata as {
    card_last4?: string;
    debit_card_last4?: string;
    bank_account_numbers?: string[];
  } | null;

  const parts: string[] = [];
  const accountNo = meta?.bank_account_numbers?.[0];
  if (accountNo) parts.push(`Cuenta ····${accountNo.slice(-4)}`);

  if (subtype === "credit_card" && meta?.card_last4) {
    parts.push(`····${meta.card_last4}`);
  } else if (meta?.debit_card_last4) {
    parts.push(`Débito ····${meta.debit_card_last4}`);
  } else if (meta?.card_last4 && !accountNo) {
    parts.push(`····${meta.card_last4}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function reconciliationStatus(
  balance: number,
  lastStatementBalance: number | null,
  lastStatementDate: string | null,
) {
  if (lastStatementBalance === null || !lastStatementDate) {
    return {
      label: "Sin cartola cargada",
      color: "var(--muted)",
      Icon: ClockIcon,
    };
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

  // Liquid cash only — credit cards are debt, not "plata disponible"
  const totalBalance = accounts
    .filter((a) => a.subtype === "debit" || a.subtype === "cash")
    .reduce((sum, a) => sum + a.balance, 0);

  return (
    <AppShell userEmail={user.email ?? ""} title="Cuentas">
      <div className="flex flex-col gap-5">
        <div className="ng-hero ng-rise flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="m-0 text-[11px] tracking-[0.1em] text-accent-strong uppercase">
              Efectivo en cuentas
            </p>
            <p className="mt-2 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">
              <Amount>{formatCLP(totalBalance, { signed: true })}</Amount>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={null}>
              <MonthNav month={month} basePath="/accounts" />
            </Suspense>
            <Link href="/accounts/upload" className="ng-btn ng-btn-primary">
              <UploadSimpleIcon size={16} />
              Cargar cartola
            </Link>
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {accounts.map((account) => {
            const act = activity.find((a) => a.account_id === account.id);
            const Icon = ACCOUNT_ICONS[account.subtype] ?? BankIcon;
            const hint = accountHint(account.subtype, account.metadata);
            const isCredit = account.subtype === "credit_card";
            const recon = reconciliationStatus(
              account.balance,
              account.last_statement_balance,
              account.last_statement_date,
            );
            const meta = account.metadata as {
              total_due?: number;
              cupo_utilizado?: number;
              cupo_total?: number;
              balance_source?: string;
            } | null;

            // Month movement: include transfers (inter-account cash) for debit accounts
            const monthIn = (act?.income ?? 0) + (act?.transfer_in ?? 0);
            const monthOut = (act?.expense ?? 0) + (act?.transfer_out ?? 0);

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
                    <span className="block truncate text-[15px] font-medium">
                      {account.name}
                    </span>
                    <span className="block text-xs text-faint">
                      {subtypeLabel(account.subtype)}
                      {hint ? ` · ${hint}` : ""}
                    </span>
                  </span>
                </div>

                <div>
                  {isCredit && (
                    <p className="m-0 mb-1 text-[11px] tracking-[0.08em] text-faint uppercase">
                      Por pagar
                    </p>
                  )}
                  <p
                    className="m-0 text-[28px] font-semibold tracking-[-0.02em] tabular-nums"
                    style={
                      account.balance < 0 || isCredit
                        ? { color: "var(--neg)" }
                        : undefined
                    }
                  >
                    <Amount>
                      {formatCLP(
                        isCredit ? Math.abs(account.balance) : account.balance,
                        { signed: !isCredit },
                      )}
                    </Amount>
                  </p>
                  {isCredit && meta?.cupo_utilizado != null && meta?.cupo_total != null && (
                    <p className="mt-1 m-0 text-xs text-faint">
                      Utilizado {formatCLP(meta.cupo_utilizado)} / cupo{" "}
                      {formatCLP(meta.cupo_total)}
                    </p>
                  )}
                </div>

                {(monthIn > 0 || monthOut > 0) && (
                  <div className="flex gap-5">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-faint">Entró</span>
                      <span
                        className="text-[13px] tabular-nums"
                        style={{ color: "var(--pos)" }}
                      >
                        <Amount>{formatCLP(monthIn)}</Amount>
                      </span>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-faint">Salió</span>
                      <span
                        className="text-[13px] tabular-nums"
                        style={{ color: "var(--neg)" }}
                      >
                        <Amount>{formatCLP(monthOut)}</Amount>
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
          El saldo grande es la plata actual (o deuda de la TC). El mes del
          selector filtra cuánto entró y salió en ese período, incluidas
          transferencias entre tus cuentas.
        </p>
      </div>
    </AppShell>
  );
}
