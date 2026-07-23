import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { CategorizeButton, ReviewTransactionRow } from "@/components/review-transactions";
import { getCategories, getReviewTransactions } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { supabase, user } = await requireOnboarded();
  const [transactions, categories] = await Promise.all([
    getReviewTransactions(supabase),
    getCategories(supabase, { entity: "personal" }),
  ]);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Por categorizar"
      description="Confirmá o corregí categorías. Al guardar se crea una regla para el merchant."
    >
      <CategorizeButton />

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                  Todo categorizado.
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
    </AppShell>
  );
}
