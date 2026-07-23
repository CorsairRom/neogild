import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { getEmailConnectionStatus } from "@/lib/email/credentials";
import { AppShell } from "@/components/app-shell";
import {
  EmailConnectForm,
  EmailDisconnectButton,
  SyncButton,
} from "@/components/gmail-sync";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const { user } = await requireOnboarded();
  const connection = await getEmailConnectionStatus(user.id);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Configuración"
      description="Correo IMAP, reglas de categorización y cuentas bancarias."
    >
      {params.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(params.error)}
        </p>
      )}
      {params.connected && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Correo conectado correctamente.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Correo IMAP</h2>
          {connection.connected ? (
            <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <p>
                Conectado: {connection.email}
                {connection.source === "env" ? " (.env)" : ""}
              </p>
              <SyncButton />
              {connection.source === "db" && <EmailDisconnectButton />}
            </div>
          ) : (
            <div className="mt-3">
              <EmailConnectForm />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Categorización</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <Link href="/settings/rules" className="underline">
                Reglas keyword
              </Link>
            </li>
            <li>
              <code className="text-xs">GOOGLE_GENERATIVE_AI_API_KEY</code> en{" "}
              <code className="text-xs">apps/web/.env.local</code>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800 lg:col-span-2">
          <h2 className="font-medium">Cuentas bancarias</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Editá hints (últimos 4 dígitos) para matchear correos al promote.
          </p>
          <Link
            href="/settings/accounts"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Gestionar cuentas →
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
