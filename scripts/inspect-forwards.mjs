#!/usr/bin/env node
import { createImapEmailClient } from "../packages/gmail/src/imap-client.ts";

function htmlToForwardPlain(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

const client = createImapEmailClient({
  user: process.env.GMAIL_USER,
  appPassword: process.env.GMAIL_APP_PASSWORD,
});

const emails = await client.fetchSince(new Date("2026-01-01"));
for (const sub of ["RV: Cargo", "RV: Notificación", "Fw: Cartola"]) {
  const email = emails.find((e) => e.subject.includes(sub.replace("RV: ", "").replace("Fw: ", "")) || e.subject.startsWith(sub.split(":")[0]));
  const e = emails.filter((x) => x.subject.includes(sub.split(": ")[1] ?? sub));
  for (const email of e.slice(-1)) {
    const plain = htmlToForwardPlain(email.body);
    console.log("\n===", email.subject, "===");
    const idx = plain.search(/(?:De|From|Enviado|Sent|Asunto|Subject):/i);
    console.log(plain.slice(Math.max(0, idx - 20), idx + 600));
  }
}
