import { Suspense } from "react";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { CartolaUploadForm } from "@/components/cartola-upload-form";
import { getPersonalAccountBalances } from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function CartolaUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireOnboarded();
  const accounts = await getPersonalAccountBalances(supabase);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Cargar cartola"
      description="Subí el PDF de la cartola e indicá a qué cuenta pertenece."
      actions={
        <Link href="/accounts" className="text-sm text-zinc-500 hover:underline">
          ← Mis cuentas
        </Link>
      }
    >
      <div className="max-w-lg rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <Suspense fallback={<p className="text-sm text-zinc-500">Cargando…</p>}>
          <CartolaUploadForm
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            defaultAccountId={params.account}
          />
        </Suspense>
      </div>

      <p className="mt-6 max-w-lg text-xs text-zinc-500">
        Tip: desde el detalle de una cuenta podés abrir esta pantalla con la cuenta ya
        seleccionada. Las transferencias entre tus cuentas se emparejan automáticamente cuando
        detectamos tu nombre en un TEF.
      </p>
    </AppShell>
  );
}
