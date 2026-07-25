#!/usr/bin/env node
/** Import cartola PDF → transactions (service role, local dev). */
import { createClient } from "@supabase/supabase-js";
import { parseCartolaPdfBuffer } from "../apps/web/src/lib/cartola/pdf.ts";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: users } = await s.auth.admin.listUsers();
const u = users.users.find((x) => x.email === process.env.USER_EMAIL);

const { data: profile } = await s.from("profiles").select("rut").eq("id", u.id).single();
const { data: movement } = await s
  .from("email_movements")
  .select("id, attachment_path, gmail_message_id")
  .eq("source", "bancoestado_cartola")
  .single();
const { data: account } = await s
  .from("accounts")
  .select("id")
  .eq("user_id", u.id)
  .ilike("name", "%cuentarut%")
  .maybeSingle();

const { data: file } = await s.storage
  .from("email-attachments")
  .download(movement.attachment_path);

const parsed = await parseCartolaPdfBuffer(await file.arrayBuffer(), profile.rut);
let imported = 0;
let skipped = 0;
const statementMonth = parsed.meta.to?.slice(0, 7) ?? "2026-07";

for (const line of parsed.lines) {
  const isDeposit = line.deposit > 0;
  const amount = isDeposit ? line.deposit : line.charge;
  if (amount <= 0) continue;

  const { data: existing } = await s
    .from("transactions")
    .select("id")
    .eq("user_id", u.id)
    .eq("date", line.date)
    .eq("amount", amount)
    .ilike("description", `%${line.description.slice(0, 15)}%`)
    .maybeSingle();

  if (existing) {
    skipped++;
    continue;
  }

  const { error: seErr } = await s.from("statement_entries").insert({
    user_id: u.id,
    account_id: account.id,
    source: "pdf",
    statement_month: `${statementMonth}-01`,
    entry_date: line.date,
    description: line.description,
    amount,
    currency: "CLP",
    entry_type: isDeposit ? "deposit" : "charge",
    status: "new",
    upload_fingerprint: `cartola:${movement.gmail_message_id}:${line.doc}`,
  });

  if (seErr) {
    console.error("statement_entry", line.doc, seErr.message);
    continue;
  }

  const { error } = await s.from("transactions").insert({
    user_id: u.id,
    account_id: account.id,
    type: isDeposit ? "income" : "expense",
    amount,
    description: line.description,
    category: null,
    entity: "personal",
    date: line.date,
    metadata: { source: "bancoestado_cartola", cartola_doc: line.doc },
  });
  if (!error) imported++;
  else console.error("tx", line.doc, error.message);
}

await s
  .from("email_movements")
  .update({
    status: "promoted",
    raw_snippet: `Cartola: ${parsed.lines.length} mov, ${imported} importados`,
  })
  .eq("id", movement.id);

console.log({ lines: parsed.lines.length, imported, skipped, meta: parsed.meta });

const { count } = await s
  .from("transactions")
  .select("id", { count: "exact", head: true })
  .eq("user_id", u.id);
console.log("total transactions:", count);
