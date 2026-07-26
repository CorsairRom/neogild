#!/usr/bin/env node
/**
 * Load extracted cartolas (Jan→date) into local Supabase.
 *
 * Usage:
 *   python3 scripts/extract-cartolas.py
 *   npx tsx --env-file=.env --env-file=apps/web/.env.local scripts/load-cartolas.mjs
 *
 * Flags:
 *   --reset   wipe this user's transactions/statement_entries first
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
  const specs = [
    {
      key: "bch",
      name: "Cuenta Corriente Banco de Chile",
      type: "asset",
      subtype: "debit",
      metadata: { bank_account_numbers: ["1060707210", "001060707210"] },
    },
    {
      key: "be",
      name: "CuentaRUT BancoEstado",
      type: "asset",
      subtype: "debit",
      metadata: { bank_account_numbers: ["18202300"] },
    },
    {
      key: "cmr",
      name: "CMR Falabella",
      type: "liability",
      subtype: "credit_card",
      metadata: { card_last4: "5567", bank: "falabella" },
    },
    {
      key: "other",
      name: "Otras cuentas propias",
      type: "asset",
      subtype: "debit",
      on_budget: false,
      metadata: { inferred: true, note: "cuenta 10 / no rastreadas" },
    },
  ];

  const { data: existing } = await admin
    .from("accounts")
    .select("id, name, metadata, subtype")
    .eq("user_id", userId)
    .eq("is_archived", false);

  const map = {};
  for (const spec of specs) {
    let acc = (existing ?? []).find((a) =>
      a.name.toLowerCase().includes(
        spec.key === "bch"
          ? "chile"
          : spec.key === "be"
            ? "cuentarut"
            : spec.key === "cmr"
              ? "cmr"
              : "otras cuentas",
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
          on_budget: spec.on_budget ?? true,
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
        .update({ metadata: { ...(acc.metadata ?? {}), ...spec.metadata } })
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

  // CMR purchases omitted for now: statements mix installments/prior periods and
  // inflate liability vs cash reality. BCH→CMR pays still book as transfers.

  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.doc.localeCompare(b.doc));
}

function falabellaPaymentAmounts(extracted) {
  const set = new Map();
  for (const doc of extracted.banco_falabella) {
    if (doc.total_due) set.set(doc.total_due, doc.billing_date);
    for (const p of doc.payments ?? []) set.set(p.amount, p.date);
  }
  return set;
}

function classifyLine(line, falPayments) {
  const amount = line.deposit > 0 ? line.deposit : line.charge;
  const cls = classifyCartolaLine(
    line.description,
    line.deposit,
    line.charge,
    OWNER,
  );

  // CMR purchases
  if (line.accountKey === "cmr") {
    return {
      type: "expense",
      category: classifyCartolaLine(
        line.description.replace(/^CMR\s+/i, "PAGO "),
        0,
        amount,
        OWNER,
      ).category,
      kind: "pago",
      counterparty: null,
      needsReview: false,
      peerKey: null,
    };
  }

  // Banco Chile → CMR (full statement or "Cmr Mc Bd" partial pays)
  if (
    line.accountKey === "bch" &&
    line.charge > 0 &&
    (/cmr\b/i.test(line.description) ||
      (cls.kind === "tef_own" && falPayments.has(amount)))
  ) {
    return {
      type: "transfer",
      category: null,
      kind: "tef_own",
      counterparty: cls.counterparty ?? "CMR Falabella",
      needsReview: false,
      peerKey: "cmr",
    };
  }

  if (cls.kind === "tef_own") {
    return { ...cls, peerKey: null }; // resolved later by pairing
  }

  return { ...cls, peerKey: null };
}

async function insertTx(userId, accountId, {
  type,
  amount,
  description,
  category,
  date,
  transferTo,
  needsReview,
  metadata,
}) {
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
  const falPayments = falabellaPaymentAmounts(extracted);

  // Opening balances as of 2026-01-01
  // BCH: saldo final 30/12/2025 = 580535 (from cartola Dec / Jan opening)
  const bchOpenDoc = extracted.banco_chile.find((d) => d.file.includes("30012026"));
  const beOpenDoc = extracted.banco_estado.find((d) => d.cartola_no === "000001");
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
  // Prefer BancoEstado op id; for BCH keep file+row doc. Collapse only exact fingerprints.
  const seenFp = new Set();
  console.log(`importing ${lines.length} lines from ${FROM_DATE}`);

  /** @type {Array<{id:string, accountKey:string, date:string, amount:number, signed:number, kind:string, desc:string}>} */
  const ownLegs = [];
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const amount = line.deposit > 0 ? line.deposit : line.charge;
    if (amount <= 0) continue;

    // Op ids reuse across months — fingerprint must include date+amount+description.
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

    const cls = classifyLine(line, falPayments);
    const isDeposit = line.deposit > 0;
    const accountId = accounts[line.accountKey];

    // Single-leg booking first (no synthetic peer yet for generic tef_own)
    let type = cls.type;
    let signedAmount = amount;
    if (type === "transfer") {
      signedAmount = isDeposit ? amount : -amount;
    } else if (type === "expense") {
      signedAmount = amount; // schema stores positive expense; balance delta separate
    } else if (type === "income") {
      signedAmount = amount;
    }

    // Credit card: expense increases liability → store as expense; balance rebuild uses -expense for assets but for liability?
    // rebuild: expense → -amount. For liability credit cards, purchases should increase what you owe.
    // Existing TC payments book transfer INTO credit card (positive). So CMR balance convention:
    //   purchase: expense on CMR? or transfer? Looking at rebuild_account_balances:
    //   expense → -amount (makes liability more negative = more debt if starting 0)
    // Actually liability credit_card with expense -X goes more negative. Payment transfer +X reduces debt.
    // BCH pay CMR: transfer - on BCH, + on CMR. Good.

    let transferTo = cls.peerKey ? accounts[cls.peerKey] : null;
    const meta = {
      source: line.source,
      cartola_doc: line.doc,
      cartola_file: line.file,
      cartola_kind: cls.kind,
      counterparty: cls.counterparty,
      import_fp: fp,
    };

    if (cls.peerKey === "cmr" && type === "transfer") {
      // Book both legs immediately for CMR payments
      const outId = await insertTx(userId, accounts.bch, {
        type: "transfer",
        amount: -amount,
        description: `Pago CMR -> ${line.description}`,
        category: null,
        date: line.date,
        transferTo: accounts.cmr,
        needsReview: false,
        metadata: meta,
      });
      await insertTx(userId, accounts.cmr, {
        type: "transfer",
        amount: amount,
        description: `Pago CMR <- Banco de Chile`,
        category: null,
        date: line.date,
        transferTo: accounts.bch,
        needsReview: false,
        metadata: { ...meta, pair_of: outId },
      });
      imported++;
      continue;
    }

    const txAmount =
      type === "transfer" ? signedAmount : amount;

    const id = await insertTx(userId, accountId, {
      type,
      amount: txAmount,
      description: line.description,
      category: cls.category,
      date: line.date,
      transferTo,
      needsReview: cls.needsReview ?? false,
      metadata: meta,
    });

    if (cls.kind === "tef_own" && !cls.peerKey) {
      ownLegs.push({
        id,
        accountKey: line.accountKey,
        date: line.date,
        amount,
        signed: signedAmount,
        kind: isDeposit ? "in" : "out",
        desc: line.description,
      });
    }
    imported++;
  }

  // Pair own-account transfers across BCH ↔ BE (same amount, ±1 day)
  let paired = 0;
  const used = new Set();
  const outs = ownLegs.filter((l) => l.kind === "out");
  const ins = ownLegs.filter((l) => l.kind === "in");

  for (const out of outs) {
    if (used.has(out.id)) continue;
    const match = ins.find(
      (inn) =>
        !used.has(inn.id) &&
        inn.accountKey !== out.accountKey &&
        inn.amount === out.amount &&
        daysBetween(inn.date, out.date) <= 1,
    );
    if (match) {
      await admin
        .from("transactions")
        .update({ transfer_to: accounts[match.accountKey] })
        .eq("id", out.id);
      await admin
        .from("transactions")
        .update({ transfer_to: accounts[out.accountKey] })
        .eq("id", match.id);
      used.add(out.id);
      used.add(match.id);
      paired++;
    }
  }

  // Unmatched own outs → Otras cuentas propias (synthetic in-leg).
  // Never invent a synthetic out on BCH/BE for unmatched ins — those usually
  // come from untracked own accounts ("cuenta 10"), not from the tracked peer.
  let toOther = 0;
  for (const out of outs) {
    if (used.has(out.id)) continue;
    await admin
      .from("transactions")
      .update({ transfer_to: accounts.other })
      .eq("id", out.id);
    await insertTx(userId, accounts.other, {
      type: "transfer",
      amount: out.amount,
      description: `${out.desc} (entrada)`,
      category: null,
      date: out.date,
      transferTo: accounts[out.accountKey],
      needsReview: true,
      metadata: {
        source: "inferred_own_account",
        own_transfer_inferred: "untracked_peer",
        pair_of: out.id,
      },
    });
    used.add(out.id);
    toOther++;
  }

  for (const inn of ins) {
    if (used.has(inn.id)) continue;
    await admin
      .from("transactions")
      .update({ transfer_to: accounts.other })
      .eq("id", inn.id);
    await insertTx(userId, accounts.other, {
      type: "transfer",
      amount: -inn.amount,
      description: `${inn.desc} (salida)`,
      category: null,
      date: inn.date,
      transferTo: accounts[inn.accountKey],
      needsReview: true,
      metadata: {
        source: "inferred_own_account",
        own_transfer_inferred: "untracked_peer",
        pair_of: inn.id,
      },
    });
    used.add(inn.id);
    toOther++;
  }

  await admin.rpc("rebuild_account_balances", { p_user_id: userId });

  const { data: bals } = await admin
    .from("accounts")
    .select("name, balance, subtype")
    .eq("user_id", userId)
    .eq("is_archived", false);

  const cash = (bals ?? [])
    .filter((a) => a.subtype === "debit" && !/otras/i.test(a.name))
    .reduce((s, a) => s + Number(a.balance), 0);

  // Expected closings from latest cartolas
  const bchLatest = [...extracted.banco_chile].sort((a, b) =>
    (a.file > b.file ? 1 : -1),
  );
  const bchJun = extracted.banco_chile.find((d) => d.file.includes("30062026"));
  const beLatest = [...extracted.banco_estado]
    .filter((d) => d.cartola_no && d.cartola_no !== "000015")
    .sort((a, b) => a.cartola_no.localeCompare(b.cartola_no))
    .at(-1);

  const bchBal = Number(bals?.find((a) => /chile/i.test(a.name))?.balance ?? 0);
  const beBal = Number(bals?.find((a) => /cuentarut/i.test(a.name))?.balance ?? 0);
  const bchDrift = bchBal - (bchJun?.closing_balance ?? bchBal);
  const beDrift = beBal - (beLatest?.closing_balance ?? beBal);

  console.log({
    imported,
    skipped,
    paired,
    toOther,
    balances: bals,
    trackedCash: cash,
    expectedBchClose: bchJun?.closing_balance,
    expectedBeClose: beLatest?.closing_balance,
    bchDrift,
    beDrift,
    liquidaciones: extracted.liquidaciones.map((l) => ({
      period: l.period,
      net: l.net_pay,
    })),
  });

  if (Math.abs(bchDrift) <= 2000 && Math.abs(beDrift) <= 2000) {
    console.log(
      `✓ statement reconcile OK — BCH drift ${bchDrift}, BE drift ${beDrift} (≤2000)`,
    );
  } else {
    console.warn(
      `⚠ statement drift — BCH ${bchDrift} (want ~0 vs ${bchJun?.closing_balance}), BE ${beDrift} (want ~0 vs ${beLatest?.closing_balance})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
