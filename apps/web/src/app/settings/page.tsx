import Link from "next/link";
import { BankIcon, CaretRightIcon, FunnelIcon } from "@phosphor-icons/react/ssr";
import { requireOnboarded } from "@/lib/auth/session";
import { getEmailConnectionStatus } from "@/lib/email/credentials";
import { AppShell } from "@/components/app-shell";
import { ThemeSegment } from "@/components/app-shell-client";
import { PrivacyToggle } from "@/components/privacy-provider";
import {
  EmailConnectForm,
  EmailDisconnectButton,
  SyncButton,
} from "@/components/gmail-sync";
import { RutSettingsForm } from "@/components/rut-settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const { user, supabase } = await requireOnboarded();
  const connection = await getEmailConnectionStatus(user.id);

  const [{ count: rulesCount }, { count: accountsCount }] = await Promise.all([
    supabase.from("categorization_rules").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("*", { count: "exact", head: true }).eq("is_archived", false),
  ]);

  return (
    <AppShell userEmail={user.email ?? ""} title="Configuración">
      {params.error && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: "var(--neg-soft)", color: "var(--neg)" }}
        >
          {decodeURIComponent(params.error)}
        </p>
      )}
      {params.connected && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: "var(--pos-soft)", color: "var(--pos)" }}
        >
          Correo conectado correctamente.
        </p>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
      >
        <div className="ng-card flex flex-col gap-3.5 p-5">
          <h2 className="m-0 text-base font-medium">Apariencia</h2>
          <p className="m-0 text-[13px] text-muted">
            El tema también se cambia desde el menú. &ldquo;Auto&rdquo; sigue lo que tenga tu
            teléfono o computador.
          </p>
          <ThemeSegment />
          <PrivacyToggle />
        </div>

        <div className="ng-card flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2.5">
            <span
              className="size-2 rounded-full"
              style={{ background: connection.connected ? "var(--pos)" : "var(--faint)" }}
            />
            <h2 className="m-0 text-base font-medium">Correo</h2>
          </div>
          {connection.connected ? (
            <div className="flex flex-col gap-3 text-sm text-muted">
              <p className="m-0">
                Conectado: {connection.email}
                {connection.source === "env" ? " (.env)" : ""}
              </p>
              <SyncButton />
              {connection.source === "db" && <EmailDisconnectButton />}
            </div>
          ) : (
            <EmailConnectForm />
          )}
        </div>

        <div className="ng-card flex flex-col gap-3 p-5">
          <h2 className="m-0 text-base font-medium">RUT para abrir cartolas</h2>
          <p className="m-0 text-[13px] text-muted">
            Las cartolas de BancoEstado vienen con clave: los últimos 4 dígitos de tu RUT, sin el
            verificador.
          </p>
          <RutSettingsForm />
        </div>

        <div className="ng-card flex flex-col gap-3 p-5">
          <h2 className="m-0 text-base font-medium">Categorización</h2>
          <p className="m-0 text-[13px] text-muted">
            Primero se aplican tus reglas por palabra clave; lo que queda sin match lo propone la
            IA y vos confirmás.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/settings/rules"
              className="flex items-center gap-3 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-sm hover:bg-accent-soft"
            >
              <FunnelIcon size={17} color="var(--muted)" />
              <span className="flex-1">Reglas por palabra clave</span>
              <span className="text-xs text-faint">{rulesCount ?? 0}</span>
              <CaretRightIcon size={15} color="var(--faint)" />
            </Link>
            <Link
              href="/settings/accounts"
              className="flex items-center gap-3 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-sm hover:bg-accent-soft"
            >
              <BankIcon size={17} color="var(--muted)" />
              <span className="flex-1">Cuentas bancarias</span>
              <span className="text-xs text-faint">{accountsCount ?? 0}</span>
              <CaretRightIcon size={15} color="var(--faint)" />
            </Link>
            <p className="m-0 text-xs text-faint">
              <span className="font-mono">GOOGLE_GENERATIVE_AI_API_KEY</span> en{" "}
              <span className="font-mono">apps/web/.env.local</span>
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
