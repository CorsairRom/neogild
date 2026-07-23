import { requireOnboarded } from "@/lib/auth/session";
import { AppNav } from "@/components/app-nav";
import { CategorizeButton, ReviewTransactionRow } from "@/components/review-transactions";
import { getCategories, getReviewTransactions } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { supabase } = await requireOnboarded();
  const [transactions, categories] = await Promise.all([
    getReviewTransactions(supabase),
    getCategories(supabase, { entity: "personal" }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <AppNav />
        <h1 className="text-2xl font-semibold">Por categorizar</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {transactions.length} transacción(es) sin categoría o marcadas para revisión.
          Al guardar se crea una regla para el merchant (ADR-004).
        </p>
        <CategorizeButton />
      </header>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  Todo categorizado. Sync nuevos correos para ver más movimientos.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <ReviewTransactionRow key={tx.id} tx={tx} categories={categories} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
