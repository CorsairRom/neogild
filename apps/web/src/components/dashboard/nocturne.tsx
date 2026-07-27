import Link from "next/link";
import {
  ArrowsClockwiseIcon,
  BankIcon,
  CreditCardIcon,
  EnvelopeSimpleOpenIcon,
  SparkleIcon,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "@phosphor-icons/react/ssr";
import { Amount } from "@/components/privacy-provider";
import { formatCLP } from "@/lib/format";
import { categoryIcon } from "@/lib/category-icon";

const BAR_COLORS = ["var(--accent)", "var(--info)", "var(--warn)", "var(--neg)", "var(--pos)"];

export function HeroBalanceCard({
  title = "Neto del mes",
  totalBalance,
  secondaryLabel,
  secondaryValue,
  deltaLabel,
  deltaPositive,
  syncLabel,
  sparkline,
}: {
  title?: string;
  totalBalance: number;
  secondaryLabel?: string;
  secondaryValue?: string;
  deltaLabel: string | null;
  deltaPositive: boolean;
  syncLabel: string;
  sparkline: number[];
}) {
  const path = sparklinePath(sparkline);
  const DeltaIcon = deltaPositive ? TrendUpIcon : TrendDownIcon;
  return (
    <div className="ng-hero ng-rise p-6">
      <p className="m-0 text-[11px] tracking-[0.1em] text-accent-strong uppercase">
        {title}
      </p>
      <p
        className="mt-2.5 text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] tabular-nums"
        style={
          totalBalance < 0
            ? { color: "var(--neg)" }
            : totalBalance > 0
              ? { color: "var(--pos)" }
              : undefined
        }
      >
        <Amount>{formatCLP(totalBalance, { signed: true })}</Amount>
      </p>
      {secondaryLabel && secondaryValue && (
        <p className="mt-2 m-0 text-sm text-muted">
          {secondaryLabel}{" "}
          <span className="tabular-nums text-text">
            <Amount>{secondaryValue}</Amount>
          </span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {deltaLabel && (
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: deltaPositive ? "var(--pos)" : "var(--neg)" }}
          >
            <DeltaIcon size={14} weight="fill" />
            {deltaLabel}
          </span>
        )}
        <span className="text-[13px] text-muted">disponible categorizado · {syncLabel}</span>
      </div>
      <svg viewBox="0 0 320 48" preserveAspectRatio="none" className="ng-sweep mt-4 h-[52px] w-full overflow-visible">
        <polyline
          points={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={640}
        />
      </svg>
    </div>
  );
}

function sparklinePath(values: number[]) {
  if (values.length < 2) return "0,40 320,40";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 320 / (values.length - 1);
  return values
    .map((v, i) => {
      const x = Math.round(i * stepX);
      const y = Math.round(40 - ((v - min) / range) * 34);
      return `${x},${y}`;
    })
    .join(" ");
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="ng-card ng-rise p-3.5">
      <p className="m-0 text-xs text-muted">{label}</p>
      <p
        className="mt-2 text-[19px] font-semibold tabular-nums"
        style={tone === "pos" ? { color: "var(--pos)" } : tone === "neg" ? { color: "var(--neg)" } : undefined}
      >
        <Amount>{value}</Amount>
      </p>
    </div>
  );
}

export function ReviewNudge({ count, amount }: { count: number; amount: number }) {
  if (count <= 0) return null;
  return (
    <Link
      href="/review"
      className="ng-rise flex items-center gap-3.5 rounded-[14px] p-4"
      style={{ border: "1px solid var(--warn)", background: "var(--warn-soft)" }}
    >
      <SparkleIcon size={22} weight="regular" color="var(--warn)" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">
          {count} {count === 1 ? "movimiento sin categoría" : "movimientos sin categoría"}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">
          <Amount>{formatCLP(amount)}</Amount> sin asignar — te toma un minuto
        </span>
      </span>
    </Link>
  );
}

export function CategoryBreakdown({
  categories,
}: {
  categories: Array<{ label: string; amount: number }>;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted">Sin gastos categorizados este mes.</p>;
  }
  const max = Math.max(...categories.map((c) => c.amount));
  return (
    <div className="flex flex-col gap-3.5">
      {categories.map((cat, i) => {
        const Icon = categoryIcon(cat.label);
        const width = Math.max(6, Math.round((cat.amount / max) * 90));
        return (
          <div key={cat.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Icon size={15} color="var(--muted)" />
                <span className="truncate">{cat.label}</span>
              </span>
              <span className="flex-none tabular-nums text-muted">
                <Amount>{formatCLP(cat.amount)}</Amount>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="ng-grow h-full rounded-full"
                style={{ width: `${width}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ACCOUNT_ICONS: Record<string, typeof BankIcon> = {
  debit: BankIcon,
  credit_card: CreditCardIcon,
  cash: WalletIcon,
};

export function AccountsSummaryCard({
  accounts,
  month,
}: {
  accounts: Array<{
    id: string;
    name: string;
    kind: string;
    subtype: string;
    monthNet: number;
    actualBalance: number;
    totalDue?: number | null;
    minimumDue?: number | null;
    cycleStatus?: string | null;
    previousPaid?: number | null;
  }>;
  month: string;
}) {
  return (
    <div className="ng-card ng-rise flex flex-col gap-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-base font-medium">Cuentas</h2>
        <Link
          href={`/accounts?month=${month}`}
          className="ng-btn ng-btn-ghost !p-0 text-[13px]"
        >
          Ver todas
        </Link>
      </div>
      {accounts.map((acc) => {
        const Icon = ACCOUNT_ICONS[acc.subtype] ?? BankIcon;
        const isCredit = acc.subtype === "credit_card";
        const debt =
          acc.totalDue != null ? acc.totalDue : Math.abs(acc.actualBalance);
        return (
          <Link
            key={acc.id}
            href={`/accounts/${acc.id}?month=${month}`}
            className="flex items-center gap-3 rounded-[11px] bg-surface-2 p-3 hover:bg-accent-soft"
          >
            <span className="grid size-[34px] flex-none place-items-center rounded-[9px] bg-accent-soft text-accent-strong">
              <Icon size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{acc.name}</span>
              <span className="block text-xs text-faint">
                {acc.kind}
                {" · "}
                {isCredit ? "facturado " : "saldo "}
                <Amount>
                  {formatCLP(isCredit ? debt : acc.actualBalance, {
                    signed: !isCredit,
                  })}
                </Amount>
                {isCredit && acc.cycleStatus === "paid"
                  ? " · al día"
                  : isCredit && acc.minimumDue != null
                    ? ` · mín ${formatCLP(acc.minimumDue)}`
                    : ""}
              </span>
            </span>
            <span
              className="flex-none text-sm font-semibold tabular-nums"
              style={
                acc.monthNet < 0
                  ? { color: "var(--neg)" }
                  : acc.monthNet > 0
                    ? { color: "var(--pos)" }
                    : undefined
              }
            >
              <Amount>{formatCLP(acc.monthNet, { signed: true })}</Amount>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function TrendChart({
  points,
}: {
  points: Array<{ label: string; ingresos: number; gastos: number }>;
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.ingresos, p.gastos]));
  const stepX = points.length > 1 ? 304 / (points.length - 1) : 0;
  const toPath = (key: "ingresos" | "gastos") =>
    points
      .map((p, i) => {
        const x = Math.round(8 + i * stepX);
        const y = Math.round(104 - (p[key] / max) * 96);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="ng-card ng-rise flex flex-col gap-4 p-5">
      <h2 className="m-0 text-base font-medium">Ingresos y gastos · 6 meses</h2>
      <svg viewBox="0 0 320 120" preserveAspectRatio="none" className="h-[150px] w-full overflow-visible">
        <polyline
          points={toPath("ingresos")}
          fill="none"
          stroke="var(--pos)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={640}
          className="ng-sweep"
        />
        <polyline
          points={toPath("gastos")}
          fill="none"
          stroke="var(--neg)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={640}
          className="ng-sweep"
        />
      </svg>
      <div className="flex justify-between text-[11px] text-faint">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5" style={{ background: "var(--pos)" }} />
          Ingresos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5" style={{ background: "var(--neg)" }} />
          Gastos
        </span>
      </div>
    </div>
  );
}

export function EmailStatusCard({
  connected,
  email,
  syncLabel,
  syncSlot,
}: {
  connected: boolean;
  email?: string | null;
  syncLabel: string;
  syncSlot?: React.ReactNode;
}) {
  return (
    <div className="ng-card ng-rise flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="size-2 flex-none rounded-full"
          style={{ background: connected ? "var(--pos)" : "var(--faint)" }}
        />
        <h2 className="m-0 flex-1 text-base font-medium">
          {connected ? "Correo conectado" : "Correo sin conectar"}
        </h2>
        <EnvelopeSimpleOpenIcon size={18} color="var(--muted)" />
      </div>
      <p className="m-0 text-[13px] text-muted">
        {connected ? `${email} · ${syncLabel}` : "IMAP no conectado"}
      </p>
      {connected ? (
        syncSlot
      ) : (
        <Link href="/settings" className="ng-btn ng-btn-secondary self-start text-sm">
          <ArrowsClockwiseIcon size={16} />
          Configurar correo
        </Link>
      )}
    </div>
  );
}
