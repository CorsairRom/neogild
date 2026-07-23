import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppNav } from "@/components/app-nav";
import { RulesManager } from "@/components/rules-manager";
import { getCategories, getCategorizationRules } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { supabase } = await requireOnboarded();
  const [rules, categories] = await Promise.all([
    getCategorizationRules(supabase),
    getCategories(supabase, { entity: "personal" }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <AppNav />
        <h1 className="text-2xl font-semibold">Reglas de categorización</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Keywords en merchant/descripción → categoría. Se combinan con LLM (Gemini) para
          el resto.{" "}
          <Link href="/settings" className="underline">
            Configuración
          </Link>
        </p>
      </header>
      <RulesManager initialRules={rules} categories={categories} />
    </div>
  );
}
