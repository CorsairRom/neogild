import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { formatCLP } from "@/lib/format";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  subtype: string;
  balance: number;
  metadata: {
    card_last4?: string;
    card_currency?: string;
    bank_account_numbers?: string[];
  } | null;
};

export default async function AccountsSettingsPage() {
  const { supabase, user } = await requireOnboarded();

  const { data } = await supabase
    .from("accounts")
    .select("id, name, subtype, balance, metadata")
    .eq("is_archived", false)
    .order("name");
  const accounts = (data ?? []) as Account[];

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Cuentas bancarias"
      description="Hints que usa el matcher al promover correos → transacciones."
      actions={
        <Link href="/settings" className="text-sm text-muted hover:underline">
          ← Configuración
        </Link>
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          Sin cuentas.{" "}
          <Link href="/onboard" className="underline">
            Configurar onboarding
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((a) => (
            <li key={a.id} className="ng-card p-4">
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-faint">{a.subtype}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                Saldo: {formatCLP(a.balance, { signed: true })}
              </p>
              <dl className="mt-2 space-y-1 text-sm">
                {a.metadata?.card_last4 && (
                  <div className="flex gap-2">
                    <dt className="text-muted">TC ****</dt>
                    <dd>
                      {a.metadata.card_last4} ({a.metadata.card_currency ?? "CLP"})
                    </dd>
                  </div>
                )}
                {a.metadata?.bank_account_numbers?.map((n) => (
                  <div key={n} className="flex gap-2">
                    <dt className="text-muted">Cuenta</dt>
                    <dd className="font-mono text-xs">{n}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Link href="/onboard" className="mt-6 inline-block text-sm text-muted underline">
        Agregar cuentas (re-onboard manual en DB si ya onboarded)
      </Link>
    </AppShell>
  );
}
