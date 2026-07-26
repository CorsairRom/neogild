#!/usr/bin/env node
/**
 * Parse all data/cartolas/banco_falabella/*.pdf via @neogild/core parser.
 * Prints JSON array to stdout (used by extract-cartolas.py).
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFalabellaCmrText } from "@neogild/core";

const DIR = resolve("data/cartolas/banco_falabella");

const docs = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".pdf")).sort()) {
  const text = execFileSync("pdftotext", ["-layout", join(DIR, file), "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed = parseFalabellaCmrText(text);
  if (!parsed.parse_ok) {
    console.error(
      `⚠ ${file}: parse_ok=false drift=${parsed.billed_drift} due=${parsed.total_due}`,
    );
  }
  docs.push({
    bank: "banco_falabella",
    product: "cmr",
    file,
    holder_name: parsed.holder_name,
    payment_coupon: parsed.payment_coupon,
    contract_masked: parsed.contract_masked,
    card_last4: parsed.card_last4,
    billing_date: parsed.billing_date,
    period_from: parsed.period_from,
    period_to: parsed.period_to,
    pay_until: parsed.pay_until,
    total_due: parsed.total_due,
    minimum_due: parsed.minimum_due,
    cupo_total: parsed.cupo_total,
    cupo_utilizado: parsed.cupo_utilizado,
    cupo_disponible: parsed.cupo_disponible,
    previous_period: parsed.previous_period,
    lines: parsed.lines,
    billed_drift: parsed.billed_drift,
    parse_ok: parsed.parse_ok,
    // Convenience for loader pairing
    payments: parsed.lines
      .filter((l) => l.kind === "payment")
      .map((l) => ({
        date: l.date,
        amount: Math.abs(l.billed_amount),
        description: l.description,
      })),
  });
}

process.stdout.write(JSON.stringify(docs));
