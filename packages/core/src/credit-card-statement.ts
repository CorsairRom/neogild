/** Generic credit-card statement summary stored on account.metadata. */

export type CreditCardStatementSummary = {
  billing_date: string | null
  total_due: number | null
  minimum_due: number | null
  pay_until: string | null
  cupo_total: number | null
  cupo_utilizado: number | null
  cupo_disponible: number | null
  file?: string | null
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function normalizeSummary(raw: Record<string, unknown>): CreditCardStatementSummary {
  return {
    billing_date: asString(raw.billing_date),
    total_due: asNumber(raw.total_due),
    minimum_due: asNumber(raw.minimum_due),
    pay_until: asString(raw.pay_until),
    cupo_total: asNumber(raw.cupo_total),
    cupo_utilizado: asNumber(raw.cupo_utilizado),
    cupo_disponible: asNumber(raw.cupo_disponible),
    file: asString(raw.file) ?? asString(raw.statement_file),
  }
}

/** Pick statement for a month (billing_date YYYY-MM-*) or fall back to latest. */
export function creditCardStatementFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  month?: string | null,
): CreditCardStatementSummary | null {
  if (!metadata) return null

  const list = Array.isArray(metadata.statements)
    ? metadata.statements
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map(normalizeSummary)
        .filter((s) => s.billing_date && s.total_due != null)
        .sort((a, b) => (a.billing_date ?? '').localeCompare(b.billing_date ?? ''))
    : []

  if (month) {
    const hit = [...list].reverse().find((s) => s.billing_date?.startsWith(month))
    if (hit) return hit
  }

  if (list.length > 0) return list[list.length - 1]!

  const top = normalizeSummary(metadata)
  if (top.total_due == null && top.billing_date == null) return null
  return top
}

/** Upsert one statement into metadata.statements and refresh top-level latest fields. */
export function mergeCreditCardStatementMetadata(
  existing: Record<string, unknown> | null | undefined,
  statement: CreditCardStatementSummary,
): Record<string, unknown> {
  const prev = { ...(existing ?? {}) }
  const incoming = normalizeSummary(statement as unknown as Record<string, unknown>)
  const list = Array.isArray(prev.statements)
    ? prev.statements
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map(normalizeSummary)
    : []

  const nextList = [
    ...list.filter((s) => s.billing_date !== incoming.billing_date),
    incoming,
  ].sort((a, b) => (a.billing_date ?? '').localeCompare(b.billing_date ?? ''))

  const latest = nextList[nextList.length - 1] ?? incoming

  return {
    ...prev,
    balance_source: 'statement_total_due',
    total_due: latest.total_due,
    minimum_due: latest.minimum_due,
    pay_until: latest.pay_until,
    cupo_total: latest.cupo_total,
    cupo_utilizado: latest.cupo_utilizado,
    cupo_disponible: latest.cupo_disponible,
    statement_file: latest.file ?? prev.statement_file ?? null,
    statements: nextList,
  }
}

/** Liability balance from facturado a pagar (negative). */
export function creditCardBalanceFromTotalDue(totalDue: number | null | undefined): number | null {
  if (totalDue == null || !Number.isFinite(totalDue)) return null
  return -Math.abs(totalDue)
}
