import { requireOnboarded } from "@/lib/auth/session";
import { getEmailConnectionStatus } from "@/lib/email/credentials";
import { AppShell } from "@/components/app-shell";
import {
  AccountsSummaryCard,
  CategoryBreakdown,
  EmailStatusCard,
  HeroBalanceCard,
  MiniStat,
  ReviewNudge,
  TrendChart,
} from "@/components/dashboard/nocturne";
import { SyncButton } from "@/components/gmail-sync";
import { formatCLP, formatMonthTitle } from "@/lib/format";
import {
  cashAccountsActualBalance,
  cashAccountsMonthNet,
  getAccountMonthActivity,
  getCategories,
  getCategoryBreakdown,
  getMonthlyBuckets,
  getMonthlyTrend,
  getPersonalAccountBalances,
  monthNetFromActivity,
  parseMonthParam,
} from "@neogild/core";

export const dynamic = "force-dynamic";

function subtypeLabel(subtype: string) {
  switch (subtype) {
    case "debit":
      return "Cuenta corriente";
    case "credit_card":
      return "Tarjeta de crédito";
    case "cash":
      return "Efectivo";
    default:
      return subtype;
  }
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "sin sync todavía";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "último sync hace instantes";
  if (min < 60) return `último sync hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `último sync hace ${hrs} h`;
  return `último sync hace ${Math.round(hrs / 24)} d`;
}

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

  const [buckets, breakdown, trend, reviewResult, syncResult, accounts, activity] =
    await Promise.all([
      getMonthlyBuckets(supabase, { month }),
      getCategoryBreakdown(supabase, month, categoryLabels),
      getMonthlyTrend(supabase, month, 6),
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .or("category.is.null,needs_review.eq.true")
        .in("type", ["income", "expense", "refund"]),
      supabase.from("sync_state").select("gmail_watermark").maybeSingle(),
      getPersonalAccountBalances(supabase),
      getAccountMonthActivity(supabase, month),
    ]);

  const reviewCount = reviewResult.count ?? 0;
  const syncState = syncResult.data;

  const gastos =
    buckets.necesidades + buckets.consumo + buckets.ahorro + buckets.por_categorizar;

  const monthCashNet = cashAccountsMonthNet(accounts, activity);
  const actualCash = cashAccountsActualBalance(accounts);

  const accountsForSummary = accounts.slice(0, 3).map((a) => {
    const { monthNet } = monthNetFromActivity(
      activity.find((row) => row.account_id === a.id),
    );
    return {
      id: a.id,
      name: a.name,
      kind: subtypeLabel(a.subtype),
      subtype: a.subtype,
      monthNet,
      actualBalance: a.balance,
    };
  });

  const sparkline = trend.map((p) => p.ingresos - p.gastos);

  return (
    <AppShell userEmail={user.email ?? ""} title="Resumen">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <HeroBalanceCard
            title={`Neto del mes · ${formatMonthTitle(month)}`}
            totalBalance={monthCashNet}
            secondaryLabel="Saldo actual en efectivo"
            secondaryValue={formatCLP(actualCash, { signed: true })}
            deltaLabel={
              buckets.disponible !== 0 ? formatCLP(buckets.disponible, { signed: true }) : null
            }
            deltaPositive={buckets.disponible >= 0}
            syncLabel={timeAgo(syncState?.gmail_watermark)}
            sparkline={sparkline.length > 1 ? sparkline : [0, 0]}
          />

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Entró" value={formatCLP(buckets.income)} tone="pos" />
            <MiniStat label="Salió" value={formatCLP(gastos)} tone="neg" />
            <MiniStat
              label="Te queda"
              value={formatCLP(buckets.disponible, { signed: true })}
              tone={buckets.disponible < 0 ? "neg" : undefined}
            />
          </div>

          <ReviewNudge count={reviewCount} amount={buckets.por_categorizar} />

          <div className="ng-card ng-rise flex flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-base font-medium">En qué se fue</h2>
              <a href="/transactions" className="ng-btn ng-btn-ghost !p-0 text-[13px]">
                Ver movimientos
              </a>
            </div>
            <CategoryBreakdown categories={breakdown.slice(0, 5)} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <AccountsSummaryCard accounts={accountsForSummary} month={month} />
          <TrendChart points={trend} />
          <EmailStatusCard
            connected={connection.connected}
            email={connection.email}
            syncLabel={timeAgo(syncState?.gmail_watermark)}
            syncSlot={<SyncButton />}
          />
        </div>
      </div>
    </AppShell>
  );
}
