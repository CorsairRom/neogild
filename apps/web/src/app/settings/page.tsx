import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getGmailConnectionStatus } from "@/lib/gmail/credentials";
import { GmailConnectLink, SyncButton } from "@/components/gmail-sync";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const connection = await getGmailConnectionStatus(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <header>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Inicio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Configuración</h1>
      </header>

      {params.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(params.error)}
        </p>
      )}
      {params.connected && (
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Gmail conectado correctamente.
        </p>
      )}

      <section className="space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="font-medium">Gmail</h2>
        {connection.connected ? (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Conectado
              {connection.email ? `: ${connection.email}` : ""}
              {connection.source === "env" ? " (token en .env)" : ""}
            </p>
            <SyncButton />
            <p className="text-xs text-zinc-500">
              Reenvía correos bancarios antiguos al buzón conectado; el parser
              detecta forwards y usa la fecha del movimiento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Conecta tu cuenta Gmail dedicada para leer alertas bancarias.
            </p>
            <GmailConnectLink />
            <p className="text-xs text-zinc-500">
              Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
