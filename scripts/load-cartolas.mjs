#!/usr/bin/env node
/**
 * Load extracted cartolas (Jan→date) into local Supabase.
 *
 * Usage:
 *   python3 scripts/extract-cartolas.py
 *   npx tsx --env-file=.env --env-file=apps/web/.env.local scripts/load-cartolas.mjs --reset
 *
 * Pairing rules (no phantom "Otras" legs):
 *   1. CMR ledger = Falabella statement lines only (cuota + fees + official payment)
 *   2. Official Pago tarjeta cmr ↔ one BCH/BE charge (amount ±2, date ±5d)
 *   3. Other BCH Cmr* outflows → expense needs_review (no CMR mirror)
 *   4. Own-name BCH ↔ BE same amount ±3 days → link transfer_to
 *   5. Unmatched own-name → single-leg transfer + needs_review
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { classifyCartolaLine } from "@neogild/core";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function sqlScalar(query) {
  return execFileSync(
    "psql",
    [DB_URL, "-v", "ON_ERROR_STOP=1", "-tAc", query],
    { encoding: "utf8" },
  ).trim();
}

const RESET = process.argv.includes("--reset");
const OWNER = "RICHARD ALEXIS ROMERO MOORE";
const EXTRACTED = resolve("data/cartolas/_extracted.json");
const FROM_DATE = "2026-01-01";
const PAIR_WINDOW_DAYS = 3;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function daysBetween(a, b) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
}

async function ensureUser() {
  const email = process.env.USER_EMAIL;
  if (!email) throw new Error("USER_EMAIL required");

  let userId = sqlScalar(
    `select id::text from auth.users where email = '${email.replace(/'/g, "''")}' limit 1`,
  );
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: process.env.USER_PASSWORD || "neogild-dev-password",
      email_confirm: true,
    });
    if (error) throw error;
    userId = created.user.id;
    console.log("created user", userId);
  } else {
    console.log("using user", userId);
  }

  const rut = process.env.USER_RUT || "18202300-0";
  await admin.from("profiles").upsert({
    id: userId,
    name: "Richard Alexis Romero Moore",
    rut,
    is_onboarded: true,
  });
  return userId;
}

async function ensureAccounts(userId) {
  // Archive the old phantom bucket if present — money must stay on real banks.
  const { data: phantom } = await admin
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", "%otras cuentas%")
    .maybeSingle();
  if (phantom?.id) {
    await admin
      .from("accounts")
      .update({ is_archived: true, name: "Otras cuentas propias (archivada)" })
      .eq("id", phantom.id);
    console.log("archived phantom Otras cuentas propias");
  }

  const specs = [
    {
      key: "bch",
      name: "Cuenta Corriente Banco de Chile",
      type: "asset",
      subtype: "debit",
      metadata: {
        bank: "banco_chile",
        bank_account_numbers: ["1060707210", "001060707210"],
      },
    },
    {
      key: "be",
      name: "CuentaRUT BancoEstado",
      type: "asset",
      subtype: "debit",
      metadata: {
        bank: "banco_estado",
        product: "cuentarut",
        bank_account_numbers: ["18202300"],
        // Débito asociada al producto CuentaRUT (≠ número de cuenta)
        debit_card_last4: "1958",
        instruments: [{ type: "debit_card", last4: "1958" }],
      },
    },
    {
      key: "cmr",
      name: "CMR Falabella",
      type: "liability",
      subtype: "credit_card",
      metadata: {
        bank: "falabella",
        card_last4: "5567",
        instruments: [{ type: "credit_card", last4: "5567" }],
      },
    },
  ];

  const { data: existing } = await admin
    .from("accounts")
    .select("id, name, metadata, subtype, is_archived")
    .eq("user_id", userId);

  const map = {};
  for (const spec of specs) {
    let acc = (existing ?? []).find((a) =>
      !a.is_archived &&
      a.name.toLowerCase().includes(
        spec.key === "bch" ? "chile" : spec.key === "be" ? "cuentarut" : "cmr",
      ),
    );
    if (!acc) {
      const { data, error } = await admin
        .from("accounts")
        .insert({
          user_id: userId,
          name: spec.name,
          type: spec.type,
          subtype: spec.subtype,
          entity: "personal",
          on_budget: true,
          balance: 0,
          metadata: spec.metadata,
        })
        .select("id, name")
        .single();
      if (error) throw error;
      acc = data;
      console.log("created account", acc.name);
    } else {
      await admin
        .from("accounts")
        .update({
          metadata: { ...(acc.metadata ?? {}), ...spec.metadata },
          name: spec.name,
        })
        .eq("id", acc.id);
    }
    map[spec.key] = acc.id;
  }
  return map;
}

async function resetUser(userId) {
  await admin.from("email_movements").delete().eq("user_id", userId);
  await admin.from("statement_entries").delete().eq("user_id", userId);
  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("accounts").update({ balance: 0 }).eq("user_id", userId);
  console.log("reset transactions for user");
}

async function setOpening(userId, accountId, amount, date, label) {
  if (amount == null) return;
  const { error } = await admin.from("transactions").insert({
    user_id: userId,
    account_id: accountId,
    type: "adjustment",
    amount: Number(amount),
    description: label,
    entity: "personal",
    date,
    metadata: { source: "cartola_opening", opening: true },
  });
  if (error) throw error;
}

function collectLines(extracted) {
  const lines = [];

  for (const doc of extracted.banco_chile) {
    for (const L of doc.lines) {
      if (L.date < FROM_DATE) continue;
      lines.push({
        ...L,
        accountKey: "bch",
        bank: "banco_chile",
        file: doc.file,
        source: "bancochile_cartola",
      });
    }
  }

  for (const doc of extracted.banco_estado) {
    for (const L of doc.lines) {
      if (L.date < FROM_DATE) continue;
      lines.push({
        ...L,
        accountKey: "be",
        bank: "banco_estado",
        file: doc.file,
        source: "bancoestado_cartola",
      });
    }
  }

  return lines.sort(
    (a, b) => a.date.localeCompare(b.date) || a.doc.localeCompare(b.doc),
  );
}

function isCmrLabeled(description) {
  return /cmr\b|tarjeta\s*cmr/i.test(description);
}

/** Official statement payments: { date, amount, billing_date, file }[] */
function falabellaOfficialPayments(extracted) {
  const out = [];
  for (const doc of extracted.banco_falabella ?? []) {
    for (const p of doc.payments ?? []) {
      if (!p.amount || p.amount <= 1) continue;
      out.push({
        date: p.date,
        amount: p.amount,
        billing_date: doc.billing_date,
        file: doc.file,
      });
    }
  }
  return out;
}

function amountsClose(a, b, tol = 2) {
  return Math.abs(a - b) <= tol;
}

function classifyLine(line) {
  const cls = classifyCartolaLine(
    line.description,
    line.deposit,
    line.charge,
    OWNER,
  );

  // BCH/BE lines labeled CMR that are NOT the official statement payment:
  // keep as expense on the bank account — do NOT invent a CMR mirror.
  if (line.charge > 0 && isCmrLabeled(line.description)) {
    return {
      type: "expense",
      category: "deuda.cuota",
      kind: "cmr_partial",
      counterparty: "CMR Falabella",
      needsReview: true,
      peerKey: null,
      reviewReason:
        "Traspaso Cmr* sin pago oficial del estado Falabella. Revisar si es abono parcial.",
    };
  }

  if (cls.kind === "tef_own") {
    return { ...cls, peerKey: null };
  }

  return { ...cls, peerKey: null };
}

async function insertTx(
  userId,
  accountId,
  { type, amount, description, category, date, transferTo, needsReview, metadata },
) {
  const { data, error } = await admin
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      type,
      amount,
      description,
      category,
      entity: "personal",
      date,
      transfer_to: transferTo ?? null,
      needs_review: needsReview ?? false,
      metadata,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const extracted = JSON.parse(readFileSync(EXTRACTED, "utf8"));
  const userId = await ensureUser();
  if (RESET) await resetUser(userId);
  const accounts = await ensureAccounts(userId);
  const officialPays = falabellaOfficialPayments(extracted).map((p) => ({
    ...p,
    used: false,
  }));

  const bchOpenDoc = extracted.banco_chile.find((d) =>
    d.file.includes("30012026"),
  );
  const beOpenDoc = extracted.banco_estado.find(
    (d) => d.cartola_no === "000001",
  );
  if (RESET) {
    await setOpening(
      userId,
      accounts.bch,
      bchOpenDoc?.opening_balance ?? 580535,
      "2025-12-30",
      "Saldo inicial Banco de Chile",
    );
    await setOpening(
      userId,
      accounts.be,
      beOpenDoc?.opening_balance ?? 35440,
      "2026-01-01",
      "Saldo inicial CuentaRUT",
    );
  }

  const lines = collectLines(extracted);
  const seenFp = new Set();
  console.log(`importing ${lines.length} bank lines from ${FROM_DATE}`);

  /** @type {Array<{id:string, accountKey:string, date:string, amount:number, kind:string, desc:string}>} */
  const ownLegs = [];
  let imported = 0;
  let skipped = 0;
  let cmrPays = 0;
  let cmrStatementLines = 0;

  function claimOfficialPayment(amount, date) {
    let best = null;
    let bestDays = 6;
    for (const p of officialPays) {
      if (p.used) continue;
      if (!amountsClose(p.amount, amount, 2)) continue;
      const days = daysBetween(p.date, date);
      if (days <= 5 && days < bestDays) {
        best = p;
        bestDays = days;
      }
    }
    if (best) best.used = true;
    return best;
  }

  for (const line of lines) {
    const amount = line.deposit > 0 ? line.deposit : line.charge;
    if (amount <= 0) continue;

    const fp = `${line.source}:${line.file}:${line.doc}:${line.date}:${amount}:${line.description}`;
    if (seenFp.has(fp)) {
      skipped++;
      continue;
    }
    seenFp.add(fp);

    const { data: existing } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .contains("metadata", { import_fp: fp })
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const isDeposit = line.deposit > 0;
    const accountId = accounts[line.accountKey];
    const meta = {
      source: line.source,
      cartola_doc: line.doc,
      cartola_file: line.file,
      import_fp: fp,
    };

    // Official CMR statement payment ↔ this bank charge
    if (!isDeposit && line.charge > 0) {
      const pay = claimOfficialPayment(amount, line.date);
      if (pay) {
        const bankLabel =
          line.accountKey === "be" ? "BancoEstado" : "Banco de Chile";
        const outId = await insertTx(userId, accountId, {
          type: "transfer",
          amount: -amount,
          description: line.description,
          category: null,
          date: line.date,
          transferTo: accounts.cmr,
          needsReview: false,
          metadata: {
            ...meta,
            peer: "cmr",
            falabella_payment: true,
            falabella_file: pay.file,
            falabella_billing_date: pay.billing_date,
          },
        });
        await insertTx(userId, accounts.cmr, {
          type: "transfer",
          amount: amount,
          description: `Pago tarjeta CMR <- ${bankLabel}`,
          category: null,
          date: pay.date,
          transferTo: accountId,
          needsReview: false,
          metadata: {
            source: "falabella_cmr",
            falabella_file: pay.file,
            falabella_billing_date: pay.billing_date,
            kind: "payment",
            pair_of: outId,
            peer: line.accountKey,
            import_fp: `falabella:${pay.file}:payment:${pay.date}:${pay.amount}`,
          },
        });
        imported++;
        cmrPays++;
        continue;
      }
    }

    const cls = classifyLine(line);
    const type = cls.type;
    const signedAmount =
      type === "transfer" ? (isDeposit ? amount : -amount) : amount;

    const id = await insertTx(userId, accountId, {
      type,
      amount: type === "transfer" ? signedAmount : amount,
      description: line.description,
      category: cls.category,
      date: line.date,
      transferTo: null,
      needsReview: cls.needsReview ?? false,
      metadata: {
        ...meta,
        cartola_kind: cls.kind,
        counterparty: cls.counterparty,
        ...(cls.reviewReason ? { review_reason: cls.reviewReason } : {}),
      },
    });

    if (cls.kind === "tef_own") {
      ownLegs.push({
        id,
        accountKey: line.accountKey,
        date: line.date,
        amount,
        kind: isDeposit ? "in" : "out",
        desc: line.description,
      });
    }
    imported++;
  }

  // CMR statement lines (cuotas, fees, taxes, insurance). Payments already paired above.
  for (const doc of extracted.banco_falabella ?? []) {
    if (!doc.parse_ok && doc.parse_ok !== undefined) {
      console.warn(`skip CMR lines for ${doc.file} (parse_ok=false)`);
      continue;
    }
    if (!doc.billing_date || doc.billing_date < FROM_DATE) continue;

    for (const [idx, L] of (doc.lines ?? []).entries()) {
      if (L.kind === "payment") continue; // paired (or orphan handled below)

      const billed = Number(L.billed_amount);
      if (billed === 0) continue;

      const fp = `falabella:${doc.file}:${L.kind}:${L.date}:${L.description}:${billed}:${idx}`;
      if (seenFp.has(fp)) {
        skipped++;
        continue;
      }
      seenFp.add(fp);

      const { data: existing } = await admin
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .contains("metadata", { import_fp: fp })
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const isCredit = billed < 0;
      const type = isCredit ? "refund" : "expense";
      const category =
        L.kind === "insurance" || L.kind === "fee" || L.kind === "tax"
          ? "deuda.cuota"
          : null;

      await insertTx(userId, accounts.cmr, {
        type,
        amount: Math.abs(billed),
        description: L.description,
        category,
        date: doc.billing_date,
        transferTo: null,
        needsReview: false,
        metadata: {
          source: "falabella_cmr",
          falabella_file: doc.file,
          falabella_billing_date: doc.billing_date,
          purchase_date: L.date,
          section: L.section,
          kind: L.kind,
          purchase_amount: L.purchase_amount,
          installment_progress: L.installment_progress,
          import_fp: fp,
        },
      });
      imported++;
      cmrStatementLines++;
    }
  }

  // Unmatched official payments → CMR-only transfer, needs_review
  for (const pay of officialPays) {
    if (pay.used) continue;
    if (pay.date < FROM_DATE) continue;
    const fp = `falabella:${pay.file}:payment:${pay.date}:${pay.amount}:unpaired`;
    await insertTx(userId, accounts.cmr, {
      type: "transfer",
      amount: pay.amount,
      description: "Pago tarjeta CMR (sin espejo en cartola débito)",
      category: null,
      date: pay.date,
      transferTo: null,
      needsReview: true,
      metadata: {
        source: "falabella_cmr",
        falabella_file: pay.file,
        falabella_billing_date: pay.billing_date,
        kind: "payment",
        import_fp: fp,
        review_reason: "Pago del estado sin cargo coincidente en BCH/BE (±5d, ±2 CLP).",
      },
    });
    imported++;
  }

  // Pair own-name transfers across BCH ↔ BE (±3 days for bank settlement lag)
  let paired = 0;
  const used = new Set();
  const outs = ownLegs.filter((l) => l.kind === "out");
  const ins = ownLegs.filter((l) => l.kind === "in");

  for (const out of outs) {
    if (used.has(out.id)) continue;
    let best = null;
    let bestDays = PAIR_WINDOW_DAYS + 1;
    for (const inn of ins) {
      if (used.has(inn.id)) continue;
      if (inn.accountKey === out.accountKey) continue;
      if (inn.amount !== out.amount) continue;
      const days = daysBetween(inn.date, out.date);
      if (days <= PAIR_WINDOW_DAYS && days < bestDays) {
        best = inn;
        bestDays = days;
      }
    }
    if (!best) continue;

    const { data: outRow } = await admin
      .from("transactions")
      .select("metadata")
      .eq("id", out.id)
      .single();
    const { data: inRow } = await admin
      .from("transactions")
      .select("metadata")
      .eq("id", best.id)
      .single();
    await admin
      .from("transactions")
      .update({
        transfer_to: accounts[best.accountKey],
        needs_review: false,
        metadata: {
          ...(outRow?.metadata ?? {}),
          paired_own_transfer: true,
          pair_lag_days: bestDays,
          pair_of: best.id,
        },
      })
      .eq("id", out.id);
    await admin
      .from("transactions")
      .update({
        transfer_to: accounts[out.accountKey],
        needs_review: false,
        metadata: {
          ...(inRow?.metadata ?? {}),
          paired_own_transfer: true,
          pair_lag_days: bestDays,
          pair_of: out.id,
        },
      })
      .eq("id", best.id);

    used.add(out.id);
    used.add(best.id);
    paired++;
  }

  // Unmatched own-name: keep single leg, flag for review — do NOT invent peer account
  let needsReviewOwn = 0;
  for (const leg of ownLegs) {
    if (used.has(leg.id)) continue;
    const { data: row } = await admin
      .from("transactions")
      .select("metadata")
      .eq("id", leg.id)
      .single();
    await admin
      .from("transactions")
      .update({
        needs_review: true,
        metadata: {
          ...(row?.metadata ?? {}),
          own_transfer_unpaired: true,
          review_reason:
            "Transferencia propia sin espejo en otra cartola (±3 días). Revisar destino/origen.",
        },
      })
      .eq("id", leg.id);
    needsReviewOwn++;
  }

  await admin.rpc("rebuild_account_balances", { p_user_id: userId });

  // Stamp last cartola close on debit accounts (UI reconciliation badge)
  const bchJun = extracted.banco_chile.find((d) => d.file.includes("30062026"));
  const beLatest = [...extracted.banco_estado]
    .filter((d) => d.cartola_no && d.cartola_no !== "000015")
    .sort((a, b) => a.cartola_no.localeCompare(b.cartola_no))
    .at(-1);

  if (bchJun?.closing_balance != null) {
    await admin
      .from("accounts")
      .update({
        last_statement_balance: bchJun.closing_balance,
        last_statement_date: "2026-06-30",
      })
      .eq("id", accounts.bch);
  }
  if (beLatest?.closing_balance != null) {
    const beCloseDate =
      beLatest.lines?.length > 0
        ? [...beLatest.lines].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
            .date
        : null;
    await admin
      .from("accounts")
      .update({
        last_statement_balance: beLatest.closing_balance,
        last_statement_date: beCloseDate,
      })
      .eq("id", accounts.be);
  }

  // CMR: balance = -total_due from latest estado (deuda facturada), not sum of pays.
  // Payments stay on the ledger for BCH traceability; CMR display is statement-sourced.
  const falLatest = [...extracted.banco_falabella]
    .filter((d) => d.billing_date && d.total_due != null)
    .sort((a, b) => a.billing_date.localeCompare(b.billing_date))
    .at(-1);

  if (falLatest) {
    const debt = -Math.abs(falLatest.total_due);
    const { data: cmrRow } = await admin
      .from("accounts")
      .select("metadata")
      .eq("id", accounts.cmr)
      .single();
    await admin
      .from("accounts")
      .update({
        balance: debt,
        last_statement_balance: debt,
        last_statement_date: falLatest.billing_date,
        metadata: {
          ...(cmrRow?.metadata ?? {}),
          balance_source: "statement_total_due",
          total_due: falLatest.total_due,
          minimum_due: falLatest.minimum_due,
          cupo_total: falLatest.cupo_total,
          cupo_utilizado: falLatest.cupo_utilizado,
          cupo_disponible: falLatest.cupo_disponible,
          statement_file: falLatest.file,
        },
      })
      .eq("id", accounts.cmr);
  }

  const { data: bals } = await admin
    .from("accounts")
    .select(
      "name, balance, subtype, is_archived, metadata, last_statement_balance, last_statement_date",
    )
    .eq("user_id", userId)
    .eq("is_archived", false);

  const cash = (bals ?? [])
    .filter((a) => a.subtype === "debit")
    .reduce((s, a) => s + Number(a.balance), 0);

  const bchBal = Number(
    bals?.find((a) => /chile/i.test(a.name))?.balance ?? 0,
  );
  const beBal = Number(
    bals?.find((a) => /cuentarut/i.test(a.name))?.balance ?? 0,
  );
  const cmrBal = Number(
    bals?.find((a) => /cmr/i.test(a.name))?.balance ?? 0,
  );
  const bchDrift = bchBal - (bchJun?.closing_balance ?? bchBal);
  const beDrift = beBal - (beLatest?.closing_balance ?? beBal);

  console.log({
    imported,
    skipped,
    paired,
    cmrPays,
    cmrStatementLines,
    needsReviewOwn,
    balances: bals?.map((a) => ({
      name: a.name,
      balance: a.balance,
      subtype: a.subtype,
      last_statement_balance: a.last_statement_balance,
      last_statement_date: a.last_statement_date,
    })),
    trackedCash: cash,
    cmrDebt: cmrBal,
    falabella: falLatest
      ? {
          billing_date: falLatest.billing_date,
          total_due: falLatest.total_due,
          cupo_utilizado: falLatest.cupo_utilizado,
        }
      : null,
    expectedBchClose: bchJun?.closing_balance,
    expectedBeClose: beLatest?.closing_balance,
    bchDrift,
    beDrift,
  });

  if (Math.abs(bchDrift) <= 2000 && Math.abs(beDrift) <= 2000) {
    console.log(
      `✓ statement reconcile OK — BCH drift ${bchDrift}, BE drift ${beDrift}, CMR por pagar ${cmrBal}`,
    );
  } else {
    console.warn(`⚠ statement drift — BCH ${bchDrift}, BE ${beDrift}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
