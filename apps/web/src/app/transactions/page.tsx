import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import {
  TransactionCategorySelect,
  TransactionFilters,
} from "@/components/transaction-table";
import { formatCLP } from "@/lib/format";
import { getCategories, getTransactions, parseMonthParam } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.month);
  const categoryFilter = params.category ?? "";
  const { supabase, user } = await requireOnboarded();

  const categories = await getCategories(supabase, { entity: "personal" });
  const transactions = await getTransactions(supabase, {
    month,
    category: categoryFilter || undefined,
    limit: 100,
    types: ["income", "expense", "refund"],
  });

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Transacciones"
      description="Ledger filtrable por mes y categoría. Editá la categoría inline."
    >
      <TransactionFilters month={month} category={categoryFilter} categories={categories} />

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                  Sin transacciones para este filtro.{" "}
                  <Link href="/" className="underline">
                    Volver al dashboard
                  </Link>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(tx.date).toLocaleDateString("es-CL")}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{tx.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        tx.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                      }
                    >
                      {formatCLP(tx.amount, { signed: tx.type === "income" })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TransactionCategorySelect
                      transactionId={tx.id}
                      currentCategory={tx.category}
                      categories={categories}
                      needsReview={tx.needs_review}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{tx.type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
