import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import {
  CategorizeButton,
  ReviewBoard,
  type CardSuggestions,
} from "@/components/review-transactions";
import {
  getCategories,
  getCategorizationRules,
  getReviewTransactions,
  getTransactions,
} from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { supabase, user } = await requireOnboarded();
  const [transactions, categories, rules, recent] = await Promise.all([
    getReviewTransactions(supabase),
    getCategories(supabase, { entity: "personal" }),
    getCategorizationRules(supabase),
    getTransactions(supabase, {
      types: ["income", "expense", "refund"],
      limit: 300,
    }),
  ]);

  const categoryLabels = new Map(categories.map((c) => [c.id, c.name]));

  const frequency = new Map<string, number>();
  for (const tx of recent ?? []) {
    if (!tx.category) continue;
    frequency.set(tx.category, (frequency.get(tx.category) ?? 0) + 1);
  }
  const topCategories = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const suggestions: Record<string, CardSuggestions> = {};
  for (const tx of transactions) {
    const ruleMatch = rules.find((r) =>
      tx.description?.toUpperCase().includes(r.pattern.toUpperCase()),
    );
    const suggestedId = tx.category ?? ruleMatch?.category ?? topCategories[0] ?? null;
    const candidates = [...new Set([suggestedId, ...topCategories])].filter(
      (id): id is string => !!id && id !== suggestedId,
    );
    suggestions[tx.id] = {
      suggested: suggestedId
        ? { id: suggestedId, label: categoryLabels.get(suggestedId) ?? suggestedId }
        : null,
      alt1: candidates[0]
        ? { id: candidates[0], label: categoryLabels.get(candidates[0]) ?? candidates[0] }
        : null,
      alt2: candidates[1]
        ? { id: candidates[1], label: categoryLabels.get(candidates[1]) ?? candidates[1] }
        : null,
    };
  }

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Por categorizar"
      description="Deslizá la tarjeta o tocá una categoría para confirmarla."
      actions={<CategorizeButton />}
    >
      <ReviewBoard transactions={transactions} categories={categories} suggestions={suggestions} />
    </AppShell>
  );
}
