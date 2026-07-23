"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";

type Account = {
  id: string;
  name: string;
  subtype: string;
  metadata: {
    card_last4?: string;
    card_currency?: string;
    bank_account_numbers?: string[];
  } | null;
};

export default function AccountsSettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <AppNav />
          <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
            ← Configuración
          </Link>
          <h1 className="text-2xl font-semibold">Cuentas bancarias</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Hints que usa el matcher al promover correos → transacciones.
          </p>
        </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Sin cuentas.{" "}
          <Link href="/onboard" className="underline">
            Configurar onboarding
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-zinc-500">{a.subtype}</p>
              <dl className="mt-2 space-y-1 text-sm">
                {a.metadata?.card_last4 && (
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">TC ****</dt>
                    <dd>
                      {a.metadata.card_last4} ({a.metadata.card_currency ?? "CLP"})
                    </dd>
                  </div>
                )}
                {a.metadata?.bank_account_numbers?.map((n) => (
                  <div key={n} className="flex gap-2">
                    <dt className="text-zinc-500">Cuenta</dt>
                    <dd className="font-mono text-xs">{n}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Link href="/onboard" className="text-sm underline text-zinc-600">
        Agregar cuentas (re-onboard manual en DB si ya onboarded)
      </Link>
    </div>
  );
}
