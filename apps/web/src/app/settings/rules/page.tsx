import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RulesManager } from "@/components/rules-manager";
import { getCategories, getCategorizationRules } from "@neogild/core";
import { requireOnboarded } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { supabase, user } = await requireOnboarded();
  const [rules, categories] = await Promise.all([
    getCategorizationRules(supabase),
    getCategories(supabase, { entity: "personal" }),
  ]);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Reglas de categorización"
      actions={
        <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
          ← Configuración
        </Link>
      }
    >
      <RulesManager initialRules={rules} categories={categories} />
    </AppShell>
  );
}
