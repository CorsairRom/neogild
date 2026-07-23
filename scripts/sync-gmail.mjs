#!/usr/bin/env node
/**
 * Local Gmail sync without the web UI.
 * Requires: Supabase running, GMAIL_REFRESH_TOKEN + Google OAuth env vars,
 * and NEOGILD_USER_ID (Supabase auth.users UUID).
 *
 * Usage:
 *   NEOGILD_USER_ID=<uuid> npm run sync:gmail
 *   NEOGILD_USER_ID=<uuid> npm run sync:gmail -- --since=2026-01-01
 */
import { createClient } from "@supabase/supabase-js";
import { runGmailSync } from "@neogild/gmail";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.NEOGILD_USER_ID;
const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1];

if (!serviceKey || !userId || !clientId || !clientSecret || !refreshToken) {
  console.error(`
Missing env. Required:
  SUPABASE_SERVICE_ROLE_KEY
  NEOGILD_USER_ID          (your auth.users id from Supabase Studio)
  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  GMAIL_REFRESH_TOKEN
`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const summary = await runGmailSync({
  userId,
  since: sinceArg,
  oauth: { clientId, clientSecret, refreshToken },
  supabase,
  mode: "cron",
});

console.log(JSON.stringify(summary, null, 2));
