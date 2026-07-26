import Link from "next/link";
import {
  CheckCircleIcon,
  ClockIcon,
  FilePdfIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { SyncButton } from "@/components/gmail-sync";
import { Amount } from "@/components/privacy-provider";

export const dynamic = "force-dynamic";

function formatCLP(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: typeof CheckCircleIcon }
> = {
  pending: { label: "pendiente", color: "var(--warn)", bg: "var(--warn-soft)", Icon: ClockIcon },
  pending_attachment: {
    label: "cartola",
    color: "var(--info)",
    bg: "var(--info-soft)",
    Icon: FilePdfIcon,
  },
  error: {
    label: "error",
    color: "var(--neg)",
    bg: "var(--neg-soft)",
    Icon: WarningCircleIcon,
  },
  promoted: {
    label: "listo",
    color: "var(--pos)",
    bg: "var(--pos-soft)",
    Icon: CheckCircleIcon,
  },
  discarded: {
    label: "descartado",
    color: "var(--faint)",
    bg: "var(--surface-2)",
    Icon: TrashIcon,
  },
};

type Movement = {
  id: string;
  status: string;
  email_date: string | null;
  source: string;
  merchant: string | null;
  counterparty: string | null;
  amount: number | null;
  error_detail: string | null;
  attachment_path: string | null;
  raw_snippet: string | null;
};

function MovementDetail({ m, hasRut }: { m: Movement; hasRut: boolean }) {
  if (m.status === "error" && m.error_detail) {
    return <span style={{ color: "var(--neg)" }}>{m.error_detail}</span>;
  }
  if (m.status === "pending_attachment" && m.attachment_path) {
    return hasRut ? (
      <Link href={`/cartolas/${m.id}`} className="font-medium underline" style={{ color: "var(--info)" }}>
        Ver cartola
      </Link>
    ) : (
      <Link href="/settings" className="font-medium underline" style={{ color: "var(--warn)" }}>
        Configurar RUT
      </Link>
    );
  }
  if (m.status === "pending_attachment") {
    return <span style={{ color: "var(--warn)" }}>{m.error_detail ?? "Sin adjunto"}</span>;
  }
  return <>{m.raw_snippet?.slice(0, 80) ?? "—"}</>;
}

const FILTERS = [
  { value: "todos", label: (c: Record<string, number>) => `Todos · ${c.total ?? 0}` },
  { value: "pending", label: (c: Record<string, number>) => `Pendientes · ${c.pending ?? 0}` },
  { value: "pending_attachment", label: (c: Record<string, number>) => `Cartolas · ${c.pending_attachment ?? 0}` },
  { value: "error", label: (c: Record<string, number>) => `Con error · ${c.error ?? 0}` },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const activeFilter = filter ?? "todos";
  const { supabase, user } = await requireOnboarded();

  const { data: profile } = await supabase
    .from("profiles")
    .select("rut")
    .eq("id", user.id)
    .single();

  const hasRut = Boolean(profile?.rut);

  const { data: movements } = await supabase
    .from("email_movements")
    .select("*")
    .order("email_date", { ascending: false })
    .limit(80);

  const counts: Record<string, number> = { total: movements?.length ?? 0 };
  for (const m of movements ?? []) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
  }

  const visible =
    activeFilter === "todos"
      ? (movements ?? [])
      : (movements ?? []).filter((m) => m.status === activeFilter);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Correos"
      description={`Staging: ${counts.pending ?? 0} pendientes, ${counts.error ?? 0} errores, ${counts.promoted ?? 0} promovidos.`}
    >
      <div className="flex flex-col gap-4">
        <div className="ng-card flex flex-wrap items-center gap-3.5 p-4">
          <span
            className="grid size-9 flex-none place-items-center rounded-[10px]"
            style={{ background: "var(--pos-soft)", color: "var(--pos)" }}
          >
            <CheckCircleIcon size={18} />
          </span>
          <span className="min-w-[200px] flex-1">
            <span className="block text-sm font-medium">{user.email}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {counts.total} correos en staging
            </span>
          </span>
          <SyncButton />
        </div>

        {(counts.pending_attachment ?? 0) > 0 && (
          <p
            className="m-0 flex flex-wrap items-center gap-2 rounded-[14px] p-4 text-sm"
            style={{ background: "var(--info-soft)", color: "var(--text)" }}
          >
            {hasRut ? (
              <>
                Las cartolas CuentaRUT están encriptadas; se abren con los últimos 4 dígitos de tu
                RUT (guardado en{" "}
                <Link href="/settings" className="font-medium underline">
                  Configuración
                </Link>
                ).
              </>
            ) : (
              <>
                Para abrir cartolas BancoEstado, configurá tu{" "}
                <Link href="/settings" className="font-medium underline">
                  RUT en Configuración
                </Link>{" "}
                (contraseña del PDF = últimos 4 dígitos, sin dígito verificador).
              </>
            )}
          </p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "todos" ? "/inbox" : `/inbox?filter=${f.value}`}
              className={`ng-pill ${activeFilter === f.value ? "ng-pill-on" : ""}`}
            >
              {f.label(counts)}
            </Link>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="ng-card px-4 py-12 text-center text-sm text-muted">
            Sin correos. Conectá IMAP y ejecutá sync desde el dashboard.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((m) => {
              const meta = STATUS_META[m.status] ?? STATUS_META.discarded;
              return (
                <div key={m.id} className="ng-card flex items-center gap-3.5 p-3.5">
                  <span
                    className="grid size-9 flex-none place-items-center rounded-[10px]"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    <meta.Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {m.merchant ?? m.counterparty ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      <MovementDetail m={m} hasRut={hasRut} />
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-3">
                    <span className="text-sm tabular-nums">
                      <Amount>{formatCLP(m.amount)}</Amount>
                    </span>
                    <span
                      className="ng-tag"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
