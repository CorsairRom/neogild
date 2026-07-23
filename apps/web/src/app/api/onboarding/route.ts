import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@neogild/core";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    accounts: Array<{
      name: string;
      subtype: "debit" | "credit_card" | "cash";
      entity?: "personal" | "spa";
      card_last4?: string;
      card_currency?: "CLP" | "USD";
      account_number?: string;
    }>;
  };

  if (!body.accounts?.length) {
    return NextResponse.json({ error: "At least one account required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_onboarded")
    .maybeSingle();

  if (profile?.is_onboarded) {
    return NextResponse.json({ error: "Already onboarded" }, { status: 400 });
  }

  for (const acc of body.accounts) {
    const metadata: Json = {};
    if (acc.card_last4?.trim()) {
      metadata.card_last4 = acc.card_last4.replace(/\D/g, "").slice(-4);
      metadata.card_currency = acc.card_currency ?? "CLP";
    }
    if (acc.account_number?.trim()) {
      metadata.bank_account_numbers = [
        acc.account_number.replace(/\D/g, "").replace(/^0+/, ""),
      ];
    }

    const isCredit = acc.subtype === "credit_card";
    const row = {
      user_id: user.id,
      name: acc.name.trim(),
      type: isCredit ? ("liability" as const) : ("asset" as const),
      subtype: acc.subtype,
      entity: acc.entity ?? ("personal" as const),
      currency: (metadata.card_currency as string) ?? "CLP",
      balance: 0,
      credit_limit: isCredit ? 0 : null,
      metadata,
    };
    const { error } = await supabase.from("accounts").insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_onboarded: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.rpc("seed_default_categorization_rules", { p_user_id: user.id });

  return NextResponse.json({ ok: true, accounts_created: body.accounts.length });
}
