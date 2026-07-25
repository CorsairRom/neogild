/** Classify BancoEstado cartola lines into transaction type + category. */

export type CartolaLineKind =
  | 'tef_in'
  | 'tef_out'
  | 'tef_own'
  | 'pago'
  | 'giro'
  | 'abono'
  | 'cargo'
  | 'other'

export interface CartolaClassification {
  type: 'income' | 'expense' | 'transfer'
  category: string | null
  needsReview: boolean
  kind: CartolaLineKind
  counterparty: string | null
}

const MERCHANT_CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ['COPEC', 'necesidad.bencina'],
  ['SHELL', 'necesidad.bencina'],
  ['UBER EATS', 'consumo.comida'],
  ['RAPPI', 'consumo.comida'],
  ['JUMBO', 'necesidad.super'],
  ['TOTTUS', 'necesidad.super'],
  ['LIDER', 'necesidad.super'],
  ['UNIMARC', 'necesidad.super'],
  ['SPOTIFY', 'consumo.entretencion'],
  ['PRIME VIDEO', 'consumo.entretencion'],
  ['NETFLIX', 'consumo.entretencion'],
  ['PORVENIR', 'consumo.entretencion'],
  ['PRIME', 'consumo.entretencion'],
  ['FARMAC', 'necesidad.salud'],
  ['AHUMADA', 'necesidad.salud'],
  ['CRUZ VERDE', 'necesidad.salud'],
  ['METLIFE', 'necesidad.salud'],
  ['ONCOLOGIC', 'necesidad.salud'],
  ['SEGURO', 'necesidad.salud'],
]

export function normalizePersonName(name: string): string {
  return name.toUpperCase().replace(/\s+/g, ' ').trim()
}

/** At least two significant tokens match (handles "ROMERO MOORE RICHARD" vs "RICHARD ALEXIS ROMERO MOORE"). */
export function personNamesMatch(a: string, b: string): boolean {
  const tokens = (s: string) =>
    normalizePersonName(s)
      .split(' ')
      .filter((t) => t.length > 2)
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  let matches = 0
  for (const t of ta) {
    if (tb.includes(t)) matches++
  }
  return matches >= 2
}

export function matchMerchantCategory(description: string): string | null {
  const upper = description.toUpperCase()
  for (const [pattern, category] of MERCHANT_CATEGORIES) {
    if (upper.includes(pattern)) return category
  }
  return null
}

export function inferOwnerNameFromDescriptions(descriptions: string[]): string | null {
  const counts = new Map<string, number>()
  for (const desc of descriptions) {
    const m = desc.match(/^TEF (?:DE|A)\s+(.+)/i)
    if (!m) continue
    const key = normalizePersonName(m[1])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count >= 2 && count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

export function classifyCartolaLine(
  description: string,
  deposit: number,
  charge: number,
  ownerName?: string | null,
): CartolaClassification {
  const desc = description.replace(/\s+/g, ' ').trim()
  const upper = desc.toUpperCase()

  const tefIn = desc.match(/^TEF DE\s+(.+)/i)
  if (tefIn) {
    const counterparty = tefIn[1].trim()
    if (ownerName && personNamesMatch(counterparty, ownerName)) {
      return {
        type: 'transfer',
        category: null,
        needsReview: false,
        kind: 'tef_own',
        counterparty,
      }
    }
    return {
      type: 'income',
      category: 'ingreso.otro',
      needsReview: false,
      kind: 'tef_in',
      counterparty,
    }
  }

  const tefOut = desc.match(/^TEF A\s+(.+)/i)
  if (tefOut) {
    const counterparty = tefOut[1].trim()
    if (ownerName && personNamesMatch(counterparty, ownerName)) {
      return {
        type: 'transfer',
        category: null,
        needsReview: false,
        kind: 'tef_own',
        counterparty,
      }
    }
    return {
      type: 'expense',
      category: 'consumo.transferencia',
      needsReview: false,
      kind: 'tef_out',
      counterparty,
    }
  }

  if (/^GIRO(?:\s|$)/i.test(upper)) {
    return {
      type: 'expense',
      category: 'consumo.giro',
      needsReview: false,
      kind: 'giro',
      counterparty: null,
    }
  }

  if (/^PAGO\s/i.test(upper)) {
    const category = matchMerchantCategory(desc)
    return {
      type: 'expense',
      category,
      needsReview: category === null,
      kind: 'pago',
      counterparty: null,
    }
  }

  if (/^ABONO/i.test(upper) || deposit > 0) {
    return {
      type: 'income',
      category: 'ingreso.otro',
      needsReview: false,
      kind: deposit > 0 ? 'abono' : 'other',
      counterparty: null,
    }
  }

  return {
    type: 'expense',
    category: matchMerchantCategory(desc),
    needsReview: true,
    kind: 'cargo',
    counterparty: null,
  }
}
