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
import { formatCLP, formatMonthTitle } from "@/lib/format";
import {
  cashAccountsActualBalance,
  cashAccountsMonthNet,
  cycleNetChange,
  cyclePending,
  getAccountMonthActivity,
  getCreditCardCyclesByAccounts,
  getPersonalAccountBalances,
  monthNetFromActivity,
  parseMonthParam,
  type CreditCardCycleRow,
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

function cycleStatusLabel(cycle: CreditCardCycleRow): string {
  switch (cycle.status) {
    case "paid":
      return "Ciclo al día";
    case "partial":
      return "Pago parcial";
    case "overdue":
      return "Vencido";
    default:
      return cycle.paid_amount > 0 ? "Pago parcial" : "Pendiente de pago";
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

  const creditIds = accounts
    .filter((a) => a.subtype === "credit_card")
    .map((a) => a.id);
  const cyclesByAccount = await getCreditCardCyclesByAccounts(
    supabase,
    creditIds,
    month,
  );

  const monthNets = accounts.map((account) => ({
    accountId: account.id,
    ...monthNetFromActivity(activity.find((a) => a.account_id === account.id)),
  }));

  const cashMonthNet = cashAccountsMonthNet(accounts, activity);
  const cashActual = cashAccountsActualBalance(accounts);

  return (
    <AppShell userEmail={user.email ?? ""} title="Cuentas">
      <div className="flex flex-col gap-5">
        <div className="ng-hero ng-rise flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="m-0 text-[11px] tracking-[0.1em] text-accent-strong uppercase">
              Neto del mes · {formatMonthTitle(month)}
            </p>
            <p
              className="mt-2 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums"
              style={
                cashMonthNet < 0
                  ? { color: "var(--neg)" }
                  : cashMonthNet > 0
                    ? { color: "var(--pos)" }
                    : undefined
              }
            >
              <Amount>{formatCLP(cashMonthNet, { signed: true })}</Amount>
            </p>
            <p className="mt-2 m-0 text-sm text-muted">
              Saldo actual en efectivo{" "}
              <span className="tabular-nums text-text">
                <Amount>{formatCLP(cashActual, { signed: true })}</Amount>
              </span>
            </p>
          </div>
          <Link href="/accounts/upload" className="ng-btn ng-btn-primary">
            <UploadSimpleIcon size={16} />
            Cargar cartola
          </Link>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {accounts.map((account) => {
            const net = monthNets.find((n) => n.accountId === account.id);
            const monthIn = net?.monthIn ?? 0;
            const monthOut = net?.monthOut ?? 0;
            const Icon = ACCOUNT_ICONS[account.subtype] ?? BankIcon;
            const hint = accountHint(account.subtype, account.metadata);
            const isCredit = account.subtype === "credit_card";
            const cycle = isCredit ? cyclesByAccount.get(account.id) : null;
            const monthNet = isCredit
              ? cycleNetChange(cycle?.previous_paid, cycle?.total_due)
              : (net?.monthNet ?? 0);
            const recon = reconciliationStatus(
              account.balance,
              account.last_statement_balance,
              account.last_statement_date,
            );
            const pending = cycle ? cyclePending(cycle) : null;

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
                  <p className="m-0 mb-1 text-[11px] tracking-[0.08em] text-faint uppercase">
                    {isCredit ? "Neto del ciclo" : "Neto del mes"}
                  </p>
                  <p
                    className="m-0 text-[28px] font-semibold tracking-[-0.02em] tabular-nums"
                    style={
                      monthNet < 0
                        ? { color: "var(--neg)" }
                        : monthNet > 0
                          ? { color: "var(--pos)" }
                          : undefined
                    }
                  >
                    <Amount>{formatCLP(monthNet, { signed: true })}</Amount>
                  </p>
                  {isCredit && cycle ? (
                    <>
                      <p className="mt-1 m-0 text-xs text-muted">
                        Facturado{" "}
                        <span className="tabular-nums text-text">
                          <Amount>{formatCLP(cycle.total_due)}</Amount>
                        </span>
                        {pending != null && pending > 0
                          ? ` · pendiente ${formatCLP(pending)}`
                          : ""}
                      </p>
                      {cycle.minimum_due != null && (
                        <p className="mt-1 m-0 text-xs text-faint">
                          Mínimo{" "}
                          <span className="tabular-nums">
                            <Amount>{formatCLP(cycle.minimum_due)}</Amount>
                          </span>
                          {cycle.pay_until ? ` · hasta ${cycle.pay_until}` : ""}
                        </p>
                      )}
                      {cycle.cupo_utilizado != null && cycle.cupo_total != null && (
                        <p className="mt-1 m-0 text-xs text-faint">
                          Utilizado {formatCLP(cycle.cupo_utilizado)} / cupo{" "}
                          {formatCLP(cycle.cupo_total)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 m-0 text-xs text-muted">
                      Saldo actual{" "}
                      <span className="tabular-nums text-text">
                        <Amount>
                          {formatCLP(account.balance, { signed: true })}
                        </Amount>
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex gap-5">
                  {isCredit && cycle ? (
                    <>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-faint">Pagado ant.</span>
                        <span
                          className="text-[13px] tabular-nums"
                          style={{ color: "var(--pos)" }}
                        >
                          <Amount>{formatCLP(cycle.previous_paid ?? 0)}</Amount>
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-faint">Facturado</span>
                        <span
                          className="text-[13px] tabular-nums"
                          style={{ color: "var(--neg)" }}
                        >
                          <Amount>{formatCLP(cycle.total_due)}</Amount>
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                <div
                  className="flex items-center gap-2 rounded-[9px] bg-surface-2 px-3 py-2.5 text-xs"
                  style={{
                    color: isCredit
                      ? cycle?.status === "paid"
                        ? "var(--pos)"
                        : "var(--warn, #d4a017)"
                      : recon.color,
                  }}
                >
                  {isCredit ? (
                    <>
                      {cycle?.status === "paid" ? (
                        <CheckCircleIcon size={15} />
                      ) : (
                        <ClockIcon size={15} />
                      )}
                      {cycle ? cycleStatusLabel(cycle) : "Sin ciclo"}
                      {cycle?.billing_date
                        ? ` · cartola ${cycle.billing_date}`
                        : ""}
                    </>
                  ) : (
                    <>
                      <recon.Icon size={15} />
                      {recon.label}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <p className="m-0 max-w-[680px] text-[13px] leading-[1.6] text-muted">
          En cuentas de efectivo el número grande es entró − salió. En TC es el
          neto del ciclo (pagado del período anterior − facturado actual).
        </p>
      </div>
    </AppShell>
  );
}
