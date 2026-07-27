import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { ExpectedIncomesManager } from "@/components/expected-incomes-manager";

export default async function ExpectedIncomesSettingsPage() {
  const { user } = await requireOnboarded();

  return (
    <AppShell userEmail={user.email ?? ""} title="Ingresos esperados">
      <div className="mb-4">
        <Link href="/settings" className="text-sm text-muted hover:underline">
          ← Configuración
        </Link>
      </div>
      <div className="ng-card flex max-w-2xl flex-col gap-3 p-5">
        <h2 className="m-0 text-base font-medium">Haberes fijos</h2>
        <p className="m-0 text-[13px] leading-relaxed text-muted">
          Definí tu sueldo u otros ingresos recurrentes como referencia. No se
          crean movimientos contables: el Resumen los muestra como esperado /
          confirmado / pendiente cuando aparece el abono en cartola (p.ej.
          Heligrafics).
        </p>
        <ExpectedIncomesManager />
      </div>
    </AppShell>
  );
}
