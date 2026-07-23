import { Suspense } from "react";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { getEmailConnectionStatus } from "@/lib/email/credentials";
import { AppShell, StatCard } from "@/components/app-shell";
import { MonthNav } from "@/components/dashboard/month-nav";
import {
  CategoryPieChart,
  DailyBarChart,
  TrendLineChart,
} from "@/components/dashboard/charts";
import { SyncButton } from "@/components/gmail-sync";
import { formatCLP, formatMonthTitle } from "@/lib/format";
import {
  getCategories,
  getCategoryBreakdown,
  getDailyExpenses,
  getMonthlyBuckets,
  getMonthlyTrend,
  parseMonthParam,
} from "@neogild/core";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.month);
  const { supabase, user } = await requireOnboarded();
  const connection = await getEmailConnectionStatus(user.id);

  const categories = await getCategories(supabase, { entity: "personal" });
  const categoryLabels = new Map(categories.map((c) => [c.id, c.name]));

  const [buckets, breakdown, daily, trend, reviewResult, syncResult] = await Promise.all([
    getMonthlyBuckets(supabase, { month }),
    getCategoryBreakdown(supabase, month, categoryLabels),
    getDailyExpenses(supabase, month),
    getMonthlyTrend(supabase, month, 6),
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .or("category.is.null,needs_review.eq.true")
      .in("type", ["income", "expense", "refund"]),
    supabase.from("sync_state").select("gmail_watermark").maybeSingle(),
  ]);

  const reviewCount = reviewResult.count ?? 0;
  const syncState = syncResult.data;

  const gastos =
    buckets.necesidades + buckets.consumo + buckets.ahorro + buckets.por_categorizar;

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title={formatMonthTitle(month)}
      description="Distribución de gastos, tendencia y sync de correos."
      actions={
        <Suspense fallback={<span className="text-sm text-zinc-500">…</span>}>
          <MonthNav month={month} />
        </Suspense>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ingresos" value={formatCLP(buckets.income)} tone="positive" />
        <StatCard label="Gastos" value={formatCLP(gastos)} />
        <StatCard
          label="Disponible"
          value={formatCLP(buckets.disponible, { signed: true })}
          hint="Ingresos − gastos del mes"
        />
        <StatCard
          label="Por categorizar"
          value={String(reviewCount)}
          tone={reviewCount > 0 ? "warn" : "default"}
          href="/review"
          hint={reviewCount > 0 ? "Revisar transacciones" : undefined}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Gastos por categoría</h2>
          <CategoryPieChart data={breakdown} />
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Gasto diario</h2>
          <DailyBarChart data={daily} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-sm font-medium">Tendencia (6 meses)</h2>
        <TrendLineChart data={trend} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 lg:col-span-2">
          <h2 className="text-sm font-medium">Buckets del mes</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <BucketItem label="Necesidades" value={buckets.necesidades} />
            <BucketItem label="Consumo" value={buckets.consumo} />
            <BucketItem label="Ahorro" value={buckets.ahorro} />
            <BucketItem label="Sin categoría" value={buckets.por_categorizar} warn />
          </dl>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium">Sync correos</h2>
          <p className="mt-2 text-xs text-zinc-500">
            {connection.connected
              ? `Conectado${connection.email ? `: ${connection.email}` : ""}`
              : "IMAP no conectado"}
          </p>
          {connection.connected ? (
            <div className="mt-3 space-y-2">
              <SyncButton />
              {syncState?.gmail_watermark && (
                <p className="text-xs text-zinc-500">
                  Último sync:{" "}
                  {new Date(syncState.gmail_watermark).toLocaleString("es-CL")}
                </p>
              )}
            </div>
          ) : (
            <Link href="/settings" className="mt-3 inline-block text-sm underline">
              Configurar correo
            </Link>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function BucketItem({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={`mt-0.5 font-medium tabular-nums ${warn && value > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
      >
        {formatCLP(value)}
      </dd>
    </div>
  );
}
