import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { CategorizeButton, ReviewTransactionsTable } from "@/components/review-transactions";
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
      description="El tipo (ingreso/egreso) ya viene del banco. Acá solo confirmás la categoría del gasto."
    >
      <CategorizeButton />

      <div className="mt-6">
        <ReviewTransactionsTable transactions={transactions} categories={categories} />
      </div>
    </AppShell>
  );
}
