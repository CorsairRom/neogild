import {
  classifyCartolaLine,
  inferOwnerNameFromDescriptions,
} from "@neogild/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartolaLine } from "./bancoestado";

export async function importCartolaLines(
  admin: SupabaseClient,
  options: {
    userId: string;
    accountId: string;
    gmailMessageId: string;
    lines: CartolaLine[];
    statementMonth: string;
    ownerName?: string | null;
  },
): Promise<{ imported: number; skipped: number; ownerName: string | null }> {
  const inferred =
    options.ownerName ??
    inferOwnerNameFromDescriptions(options.lines.map((l) => l.description));
  let ownerName = options.ownerName ?? inferred;

  if (!options.ownerName && inferred) {
    await admin
      .from("profiles")
      .update({ name: inferred })
      .eq("id", options.userId)
      .is("name", null);
    ownerName = inferred;
  }

  let imported = 0;
  let skipped = 0;

  for (const line of options.lines) {
    const amount = line.deposit > 0 ? line.deposit : line.charge;
    if (amount <= 0) continue;

    const cls = classifyCartolaLine(
      line.description,
      line.deposit,
      line.charge,
      ownerName,
    );

    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", options.userId)
      .eq("date", line.date)
      .eq("amount", amount)
      .ilike("description", `%${line.description.slice(0, 20)}%`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const isDeposit = line.deposit > 0;
    const metadata = {
      source: "bancoestado_cartola",
      cartola_doc: line.doc,
      gmail_message_id: options.gmailMessageId,
      cartola_kind: cls.kind,
      counterparty: cls.counterparty,
    };

    await admin.from("statement_entries").insert({
      user_id: options.userId,
      account_id: options.accountId,
      source: "pdf",
      statement_month: `${options.statementMonth}-01`,
      entry_date: line.date,
      description: line.description,
      amount,
      currency: "CLP",
      entry_type: isDeposit ? "deposit" : "charge",
      status: "new",
      upload_fingerprint: `cartola:${options.gmailMessageId}:${line.doc}`,
    });

    const { error: txErr } = await admin.rpc("import_ledger_line", {
      p_user_id: options.userId,
      p_account_id: options.accountId,
      p_date: line.date,
      p_description: line.description,
      p_amount: amount,
      p_tx_type: cls.type,
      p_category: cls.category,
      p_needs_review: cls.needsReview,
      p_metadata: metadata,
      p_cartola_kind: cls.kind === "tef_own" ? "tef_own" : null,
      p_is_deposit: isDeposit,
    });

    if (!txErr) imported++;
    else console.error("cartola tx", line.doc, txErr.message);
  }

  return { imported, skipped, ownerName };
}
