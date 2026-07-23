#!/usr/bin/env node
/**
 * Local email sync via IMAP (ADR-012).
 * Requires: Supabase running, GMAIL_USER + GMAIL_APP_PASSWORD,
 * and NEOGILD_USER_ID (Supabase auth.users UUID).
 *
 * Usage:
 *   NEOGILD_USER_ID=<uuid> npm run sync:email
 *   NEOGILD_USER_ID=<uuid> npm run sync:email -- --since=2026-01-01
 */
import { createClient } from "@supabase/supabase-js";
import { createImapEmailClient, runEmailSync } from "@neogild/gmail";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.NEOGILD_USER_ID;
const imapUser = process.env.GMAIL_USER;
const appPassword = process.env.GMAIL_APP_PASSWORD;
const imapHost = process.env.GMAIL_IMAP_HOST;

const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1];

if (!serviceKey || !userId || !imapUser || !appPassword) {
  console.error(`
Missing env. Required:
  SUPABASE_SERVICE_ROLE_KEY
  NEOGILD_USER_ID          (your auth.users id from Supabase Studio)
  GMAIL_USER               (IMAP login, e.g. neogild@gmail.com)
  GMAIL_APP_PASSWORD       (16-char App Password from Google Account)
`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const summary = await runEmailSync({
  userId,
  since: sinceArg,
  client: createImapEmailClient({
    user: imapUser,
    appPassword,
    host: imapHost,
  }),
  supabase,
  mode: "cron",
});

console.log(JSON.stringify(summary, null, 2));
