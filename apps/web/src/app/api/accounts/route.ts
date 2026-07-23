import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@neogild/core";

export type AccountMetadata = {
  card_last4?: string;
  card_currency?: "CLP" | "USD";
  bank_account_numbers?: string[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, subtype, currency, balance, metadata, is_archived")
    .eq("is_archived", false)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name: string;
    subtype: "debit" | "credit_card" | "cash";
    card_last4?: string;
    card_currency?: "CLP" | "USD";
    account_number?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const metadata: AccountMetadata = {};
  if (body.card_last4?.trim()) {
    metadata.card_last4 = body.card_last4.replace(/\D/g, "").slice(-4);
    metadata.card_currency = body.card_currency ?? "CLP";
  }
  if (body.account_number?.trim()) {
    const digits = body.account_number.replace(/\D/g, "").replace(/^0+/, "");
    metadata.bank_account_numbers = [digits];
  }

  const isCredit = body.subtype === "credit_card";
  const row = {
    user_id: user.id,
    name: body.name.trim(),
    type: isCredit ? ("liability" as const) : ("asset" as const),
    subtype: body.subtype,
    entity: "personal" as const,
    currency: metadata.card_currency ?? "CLP",
    balance: 0,
    credit_limit: isCredit ? 0 : null,
    metadata: metadata as Json,
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(row)
    .select("id, name, subtype, metadata")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
