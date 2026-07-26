import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  isFalabellaCmrStatementText,
  parseFalabellaCmrText,
} from "@neogild/core";
import { rutCartolaPassword } from "../rut";
import {
  parseBancoEstadoCartolaText,
  type CartolaLine,
  type CartolaMeta,
} from "./bancoestado";

async function pdfToText(
  bytes: ArrayBuffer,
  password?: string,
): Promise<string> {
  const data = new Uint8Array(bytes);
  const pdf = await pdfjs.getDocument(
    password ? { data, password } : { data },
  ).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve rough layout with newlines between items when possible
    let lastY: number | null = null;
    for (const it of content.items) {
      if (!("str" in it)) continue;
      const y = "transform" in it && Array.isArray(it.transform) ? it.transform[5] : null;
      if (lastY != null && y != null && Math.abs(lastY - y) > 2) text += "\n";
      else if (text && !text.endsWith("\n") && !text.endsWith(" ")) text += " ";
      text += it.str;
      if (y != null) lastY = y;
    }
    text += "\n";
  }
  return text;
}

export async function decryptCartolaPdf(
  bytes: ArrayBuffer,
  rut: string | null | undefined,
): Promise<string> {
  // Try open (Falabella CMR has no password) before BancoEstado password
  try {
    return await pdfToText(bytes);
  } catch {
    /* encrypted */
  }

  const password = rutCartolaPassword(rut);
  if (!password) throw new Error("RUT no configurado");
  return pdfToText(bytes, password);
}

function falabellaToCartola(parsed: ReturnType<typeof parseFalabellaCmrText>): {
  meta: CartolaMeta;
  lines: CartolaLine[];
  kind: "falabella_cmr";
  statement: ReturnType<typeof parseFalabellaCmrText>;
} {
  const lines: CartolaLine[] = [];
  for (const [idx, L] of parsed.lines.entries()) {
    if (L.kind === "payment") {
      lines.push({
        doc: `cmr-pay-${idx}`,
        description: L.description,
        charge: 0,
        deposit: Math.abs(L.billed_amount),
        date: L.date,
        balance: 0,
      });
      continue;
    }
    const amt = Math.abs(L.billed_amount);
    if (amt === 0) continue;
    lines.push({
      doc: `cmr-${L.section}-${idx}`,
      description: L.description,
      charge: L.billed_amount >= 0 ? amt : 0,
      deposit: L.billed_amount < 0 ? amt : 0,
      // Book under billing cycle so month filter matches the estado
      date: parsed.billing_date ?? L.date,
      balance: 0,
    });
  }

  return {
    kind: "falabella_cmr",
    statement: parsed,
    meta: {
      accountNumber: parsed.card_last4 ?? "",
      issuedAt: parsed.billing_date,
      from: parsed.period_from,
      to: parsed.period_to,
      closingBalance:
        parsed.total_due != null ? -Math.abs(parsed.total_due) : null,
    },
    lines,
  };
}

export async function parseCartolaPdfBuffer(
  bytes: ArrayBuffer,
  rut: string | null | undefined,
): Promise<{
  meta: CartolaMeta;
  lines: CartolaLine[];
  kind?: "bancoestado" | "falabella_cmr";
  statement?: ReturnType<typeof parseFalabellaCmrText>;
}> {
  const text = await decryptCartolaPdf(bytes, rut);

  if (isFalabellaCmrStatementText(text)) {
    // pdf.js text is flatter than pdftotext -layout; still try the parser.
    // Prefer layout-preserving extraction when available via caller scripts.
    const parsed = parseFalabellaCmrText(text);
    return falabellaToCartola(parsed);
  }

  return { ...parseBancoEstadoCartolaText(text), kind: "bancoestado" };
}
