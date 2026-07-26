import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShellClient } from "@/components/app-shell-client";

export async function AppShell({
  userEmail,
  title,
  description,
  children,
  actions,
}: {
  userEmail: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const supabase = await createClient();

  const [reviewResult, inboxResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .or("category.is.null,needs_review.eq.true")
      .in("type", ["income", "expense", "refund"]),
    supabase
      .from("email_movements")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <AppShellClient
      userEmail={userEmail}
      title={title}
      description={description}
      actions={actions}
      reviewBadge={reviewResult.count ?? 0}
      inboxBadge={inboxResult.count ?? 0}
    >
      {children}
    </AppShellClient>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "warn" | "positive";
}) {
  const toneClass =
    tone === "warn" ? "ng-card-warn" : tone === "positive" ? "ng-card-positive" : "";

  const inner = (
    <div
      className={`ng-card p-4 ${toneClass} ${href ? "ng-card-hover-accent" : ""}`}
    >
      <p className="m-0 text-xs text-muted">{label}</p>
      <p className="mt-2 text-[19px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {inner}
      </Link>
    );
  }
  return inner;
}
