import { NextResponse } from "next/server";
import {
  createExpectedIncome,
  listExpectedIncomes,
  type ExpectedIncomeAttribution,
} from "@neogild/core";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listExpectedIncomes(supabase);
  return NextResponse.json({ incomes: rows });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const amount = Number(body.amount);
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Nombre y monto (> 0) son obligatorios" },
      { status: 400 },
    );
  }

  const attribution = (body.attribution === "cash_month"
    ? "cash_month"
    : "labor_month") as ExpectedIncomeAttribution;

  const row = await createExpectedIncome(supabase, user.id, {
    name,
    amount,
    match_pattern: body.match_pattern ?? null,
    typical_day:
      body.typical_day != null && body.typical_day !== ""
        ? Number(body.typical_day)
        : null,
    attribution,
    account_id: body.account_id || null,
  });

  return NextResponse.json({ income: row }, { status: 201 });
}
