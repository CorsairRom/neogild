import {
  ArrowDownLeftIcon,
  ArrowsLeftRightIcon,
  QuestionIcon,
} from "@phosphor-icons/react/ssr";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { TransactionCategorySelect, TransactionTypeFilters } from "@/components/transaction-table";
import { Amount } from "@/components/privacy-provider";
import { categoryIcon } from "@/lib/category-icon";
import { formatCLP } from "@/lib/format";
import { getCategories, getTransactions, parseMonthParam } from "@neogild/core";

export const dynamic = "force-dynamic";

type Tx = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string;
  category: string | null;
  needs_review: boolean;
};

function dayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  const weekday = new Intl.DateTimeFormat("es-CL", { weekday: "long" }).format(date);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const day = date.getDate();
  if (diffDays === 0) return `Hoy · ${capitalized} ${day}`;
  if (diffDays === 1) return `Ayer · ${capitalized} ${day}`;
  return `${capitalized} ${day}`;
}

function groupByDay(transactions: Tx[]) {
  const groups = new Map<string, Tx[]>();
  for (const tx of transactions) {
    const list = groups.get(tx.date) ?? [];
    list.push(tx);
    groups.set(tx.date, list);
  }
  return [...groups.entries()].map(([date, items]) => {
    const total = items.reduce((sum, tx) => {
      if (tx.type === "income" || tx.type === "refund") return sum + tx.amount;
      if (tx.type === "expense") return sum - tx.amount;
      return sum;
    }, 0);
    return { date, label: dayLabel(date), total, items };
  });
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.month);
  const filter = params.filter ?? "todas";
  const { supabase, user } = await requireOnboarded();

  const categories = await getCategories(supabase, { entity: "personal" });
  const categoryLabels = new Map(categories.map((c) => [c.id, c.name]));

  const typesFor: Record<string, string[]> = {
    todas: ["income", "expense", "refund", "transfer"],
    "sin-categoria": ["income", "expense", "refund"],
    ingresos: ["income"],
    gastos: ["expense", "refund"],
    transferencias: ["transfer"],
  };

  const [allTransactions, filteredRaw] = await Promise.all([
    getTransactions(supabase, { month, types: ["income", "expense", "refund"], limit: 200 }),
    getTransactions(supabase, {
      month,
      types: typesFor[filter] ?? typesFor.todas,
      limit: 200,
    }),
  ]);

  const uncategorizedCount = (allTransactions ?? []).filter((tx) => !tx.category).length;
  const filtered = (
    filter === "sin-categoria" ? (filteredRaw ?? []).filter((tx) => !tx.category) : filteredRaw
  ) as Tx[] | null;

  const dayGroups = groupByDay(filtered ?? []);

  return (
    <AppShell userEmail={user.email ?? ""} title="Movimientos">
      <div className="flex flex-col gap-4">
        <TransactionTypeFilters uncategorizedCount={uncategorizedCount} />

        {dayGroups.length === 0 ? (
          <div className="ng-card px-4 py-12 text-center text-sm text-muted">
            Sin transacciones para este filtro.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dayGroups.map((group) => (
              <div key={group.date} className="mt-2 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <span className="text-[11px] tracking-[0.08em] text-faint uppercase">
                    {group.label}
                  </span>
                  <span className="text-xs tabular-nums text-faint">
                    <Amount>{formatCLP(group.total, { signed: true })}</Amount>
                  </span>
                </div>
                {group.items.map((tx) => {
                  const isIncome = tx.type === "income" || tx.type === "refund";
                  const isTransfer = tx.type === "transfer";
                  const uncategorized = !tx.category && !isTransfer;
                  const Icon = isIncome
                    ? ArrowDownLeftIcon
                    : isTransfer
                      ? ArrowsLeftRightIcon
                      : uncategorized
                        ? QuestionIcon
                        : categoryIcon(categoryLabels.get(tx.category ?? "") ?? "");
                  const iconColor = isIncome
                    ? "var(--pos)"
                    : isTransfer
                      ? "var(--info)"
                      : uncategorized
                        ? "var(--warn)"
                        : "var(--accent-strong)";
                  const iconBg = isIncome
                    ? "var(--pos-soft)"
                    : isTransfer
                      ? "var(--info-soft)"
                      : uncategorized
                        ? "var(--warn-soft)"
                        : "var(--surface-2)";
                  const amountColor = isIncome
                    ? "var(--pos)"
                    : isTransfer
                      ? "var(--info)"
                      : "var(--text)";
                  return (
                    <div key={tx.id} className="ng-card flex items-center gap-3.5 p-3.5">
                      <span
                        className="grid size-[38px] flex-none place-items-center rounded-[10px]"
                        style={{ background: iconBg, color: iconColor }}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{tx.description ?? "—"}</span>
                        <span className="block truncate text-xs text-faint">
                          {isTransfer
                            ? "Transferencia entre tus cuentas"
                            : tx.category
                              ? categoryLabels.get(tx.category) ?? tx.category
                              : "Sin categoría"}
                        </span>
                      </span>
                      <span
                        className="flex-none text-sm font-semibold tabular-nums"
                        style={{ color: amountColor }}
                      >
                        <Amount>
                          {isTransfer
                            ? formatCLP(tx.amount)
                            : formatCLP(isIncome ? tx.amount : -tx.amount, { signed: true })}
                        </Amount>
                      </span>
                      {!isTransfer && (
                        <span className="flex-none">
                          <TransactionCategorySelect
                            transactionId={tx.id}
                            currentCategory={tx.category}
                            categories={categories}
                            needsReview={tx.needs_review}
                          />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
