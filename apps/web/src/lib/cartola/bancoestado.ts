/** Parse BancoEstado CuentaRUT cartola PDF text (extracted via pdf.js). */

export interface CartolaLine {
  doc: string;
  description: string;
  charge: number;
  deposit: number;
  date: string; // ISO date
  balance: number;
}

export interface CartolaMeta {
  accountNumber: string;
  issuedAt: string | null;
  from: string | null;
  to: string | null;
}

function parseCLP(raw: string): number {
  return Number.parseInt(raw.replace(/\./g, ""), 10) || 0;
}

function clDateToIso(d: string): string {
  const [day, month, year] = d.split("/");
  return `${year}-${month}-${day}`;
}

export function parseBancoEstadoCartolaText(text: string): {
  meta: CartolaMeta;
  lines: CartolaLine[];
} {
  const normalized = text.replace(/\s+/g, " ").trim();

  const accountNumber = normalized.match(/SALDO ANTERIOR\s+(\d{7,9})/i)?.[1] ?? "";
  const issuedAt =
    normalized.match(/FECHA DE EMISIÓN\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
  const period = normalized.match(
    /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+CORREO/i,
  );
  const from = period?.[1] ?? null;
  const to = period?.[2] ?? null;

  const lines: CartolaLine[] = [];
  const rowRe =
    /(\d{6,8})\s+(.+?)\s+001\s+([\d.]+)\s+([\d.]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+)/gi;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(normalized)) !== null) {
    const description = m[2].replace(/\s+/g, " ").trim();
    const charge = parseCLP(m[3]);
    const deposit = parseCLP(m[4]);
    if (charge <= 0 && deposit <= 0) continue;
    if (/^(PESOS|CAUQUENES|MONEDA|SUCURSAL)/i.test(description)) continue;
    lines.push({
      doc: m[1],
      description,
      charge,
      deposit,
      date: clDateToIso(m[5]),
      balance: parseCLP(m[6]),
    });
  }

  return {
    meta: {
      accountNumber,
      issuedAt: issuedAt ? clDateToIso(issuedAt) : null,
      from: from ? clDateToIso(from) : null,
      to: to ? clDateToIso(to) : null,
    },
    lines,
  };
}
