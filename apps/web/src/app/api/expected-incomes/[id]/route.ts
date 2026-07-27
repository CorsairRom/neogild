import { NextResponse } from "next/server";
import {
  deleteExpectedIncome,
  updateExpectedIncome,
  type ExpectedIncomeAttribution,
} from "@neogild/core";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data: owned } = await supabase
    .from("expected_incomes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const patch: Parameters<typeof updateExpectedIncome>[2] = {};
  if (body.name != null) patch.name = String(body.name).trim();
  if (body.amount != null) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }
    patch.amount = amount;
  }
  if (body.match_pattern !== undefined) {
    patch.match_pattern = body.match_pattern ? String(body.match_pattern).trim() : null;
  }
  if (body.typical_day !== undefined) {
    patch.typical_day =
      body.typical_day === null || body.typical_day === ""
        ? null
        : Number(body.typical_day);
  }
  if (body.attribution != null) {
    patch.attribution = (
      body.attribution === "cash_month" ? "cash_month" : "labor_month"
    ) as ExpectedIncomeAttribution;
  }
  if (body.account_id !== undefined) patch.account_id = body.account_id || null;
  if (body.is_active != null) patch.is_active = Boolean(body.is_active);

  const row = await updateExpectedIncome(supabase, id, patch);
  return NextResponse.json({ income: row });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owned } = await supabase
    .from("expected_incomes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await deleteExpectedIncome(supabase, id);
  return NextResponse.json({ ok: true });
}
