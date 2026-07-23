import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { RulesManager } from "@/components/rules-manager";
import { getCategories, getCategorizationRules } from "@neogild/core";
import { requireOnboarded } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { supabase } = await requireOnboarded();
  const [rules, categories] = await Promise.all([
    getCategorizationRules(supabase),
    getCategories(supabase, { entity: "personal" }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
            ← Configuración
          </Link>
          <h1 className="text-2xl font-semibold">Reglas de categorización</h1>
          <AppNav />
        </header>
        <RulesManager initialRules={rules} categories={categories} />
      </div>
    </div>
  );
}
