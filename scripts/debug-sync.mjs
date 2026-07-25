#!/usr/bin/env node
/**
 * Debug email sync — backfill desde fecha fija.
 * Usage: node --env-file=.env --env-file=apps/web/.env.local scripts/debug-sync.mjs [since=2026-01-01]
 */
import { createClient } from "@supabase/supabase-js";
import { createImapEmailClient } from "../packages/gmail/src/imap-client.ts";
import { runEmailSync } from "../packages/gmail/src/sync.ts";
import { isForwarded, unwrapForward } from "../packages/gmail/src/forward.ts";
import { isCartolaEmail, parseEmail } from "../packages/gmail/src/parsers.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const imapUser = process.env.GMAIL_USER;
const appPassword = process.env.GMAIL_APP_PASSWORD;
const sinceArg =
  process.argv.find((a) => a.startsWith("since="))?.split("=")[1] ?? "2026-01-01";

if (!serviceKey || !imapUser || !appPassword) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: user } = await supabase.auth.admin.listUsers();
const u = user?.users?.find((x) => x.email === process.env.USER_EMAIL) ?? user?.users?.[0];
if (!u) {
  console.error("No auth user found");
  process.exit(1);
}

console.log("User:", u.id, u.email);

// Reset watermark for full backfill
await supabase.from("sync_state").delete().eq("user_id", u.id);

const client = createImapEmailClient({
  user: imapUser,
  appPassword,
});

const since = new Date(sinceArg);
const emails = await client.fetchSince(since);
console.log(`\nIMAP returned ${emails.length} messages since ${sinceArg}\n`);

for (const email of emails) {
  const normalized = unwrapForward(email);
  const fwd = isForwarded(email) ? " [FWD]" : "";
  const cartola = isCartolaEmail(normalized) ? " CARTOLA" : "";
  const result = parseEmail(email);
  const att = email.attachments?.length ?? 0;
  console.log(
    `${email.subject.slice(0, 60)}${fwd}${cartola}`,
    `\n  from: ${email.from.slice(0, 50)}`,
    `\n  inner: ${normalized.from.slice(0, 50)}`,
    `\n  parse: ${result === "ignore" ? "IGNORE" : result === null ? "ERROR" : typeof result === "object" ? result.source : result}`,
    att ? `\n  attachments: ${att}` : "",
  );
}

console.log("\n--- Running full sync ---\n");
const summary = await runEmailSync({
  userId: u.id,
  since: sinceArg,
  client,
  supabase,
  mode: "cron",
});
console.log(JSON.stringify(summary, null, 2));

const { data: rows } = await supabase
  .from("email_movements")
  .select("status, source, merchant, amount, error_detail")
  .order("email_date", { ascending: false });
console.log("\nemail_movements:", rows);

const { data: txs } = await supabase
  .from("transactions")
  .select("description, amount, date, category")
  .order("date", { ascending: false })
  .limit(20);
console.log("\ntransactions:", txs);
