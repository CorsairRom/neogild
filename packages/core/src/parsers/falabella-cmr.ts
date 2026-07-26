/**
 * Generic Banco Falabella CMR credit-card statement parser.
 * Input: pdftotext -layout (or equivalent) plain text.
 * Billed amount per purchase row = cuota_mensual (last numeric column), NOT monto_compra.
 */

export type FalabellaCmrSection =
  | 'falabella'
  | 'homecenter'
  | 'tottus'
  | 'pat'
  | 'nacional'
  | 'internacional'
  | 'otros'
  | 'seguro'
  | 'cargo'
  | 'pago'

export type FalabellaCmrLineKind =
  | 'purchase_cuota'
  | 'fee'
  | 'tax'
  | 'insurance'
  | 'payment'
  | 'other'

export type FalabellaCmrLine = {
  section: FalabellaCmrSection
  date: string
  city?: string
  description: string
  holder_flag?: 'T'
  purchase_amount?: number
  installment_total?: number
  installment_progress?: string
  installment_start_month?: string
  /** Cuota facturada este ciclo; payments are negative. */
  billed_amount: number
  kind: FalabellaCmrLineKind
}

export type FalabellaCmrPreviousPeriod = {
  from: string | null
  to: string | null
  opening_balance: number | null
  billed: number | null
  paid: number | null
  closing_balance: number | null
}

export type FalabellaCmrStatement = {
  bank: 'banco_falabella'
  product: 'cmr'
  holder_name: string | null
  payment_coupon: string | null
  contract_masked: string | null
  card_last4: string | null
  billing_date: string | null
  period_from: string | null
  period_to: string | null
  pay_until: string | null
  total_due: number | null
  minimum_due: number | null
  cupo_total: number | null
  cupo_utilizado: number | null
  cupo_disponible: number | null
  previous_period: FalabellaCmrPreviousPeriod
  lines: FalabellaCmrLine[]
  /** sum(billed where kind != payment) - total_due */
  billed_drift: number | null
  parse_ok: boolean
}

const CLOSE_TOLERANCE = 20

export function parseClpAmount(raw: string | null | undefined): number {
  if (raw == null || raw === '' || raw === '-') return 0
  const s = String(raw)
    .trim()
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
  if (!s || s === '-') return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

function clDateToIso(d: string): string {
  const [day, month, year] = d.split('/')
  return `${year}-${month}-${day}`
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m?.[1]?.trim() ?? null
}

function detectPurchaseSection(header: string): FalabellaCmrSection | null {
  // Data rows contain transaction dates — never treat as section headers
  // (e.g. merchant "Compra en cuotas sodimac…" must not match SODIMAC section).
  if (/\d{2}\/\d{2}\/\d{4}/.test(header)) return null

  const h = header.trim().toUpperCase()
  if (h === 'FALABELLA') return 'falabella'
  if (h.includes('HOMECENTER') || h.includes('SODIMAC')) return 'homecenter'
  if (h === 'TOTTUS') return 'tottus'
  if (h === 'PAT') return 'pat'
  if (h.includes('COMPRAS NACIONALES')) return 'nacional'
  if (h.includes('COMPRAS INTERNACIONALES')) return 'internacional'
  if (h === 'OTROS') return 'otros'
  return null
}

/**
 * Purchase / cuota row:
 *   [city|S/I] date merchant T purchase total [progress [month]] cuota
 * Credits may omit the month token.
 */
const PURCHASE_ROW =
  /^(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+T\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(\d{2}\/\d{2})(?:\s+(\S+))?)?\s+(-?[\d.]+)\s*$/

/** Insurance: date progress description T amount … cuota */
const INSURANCE_ROW =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}-\d{2})\s+(.+?)\s+T\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+(\d{2}\/\d{2}))?(?:\s+(\S+))?\s+(-?[\d.]+)\s*$/

/** Payment / fee in 2.3 */
const CARGO_ROW_T =
  /^(?:S\/I\s+)?(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+T\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+(\d{2}\/\d{2}))?(?:\s+(\S+))?\s*(-?[\d.]+)?\s*$/

const CARGO_ROW_NO_T =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+(\d{2}\/\d{2}))?(?:\s+(\S+))?\s*(-?[\d.]+)?\s*$/

function kindForDescription(desc: string, amount: number): FalabellaCmrLineKind {
  if (amount < 0 || /pago\s+tarjeta\s+cmr/i.test(desc)) return 'payment'
  if (/seg\s+desgravamen|seguro/i.test(desc)) return 'insurance'
  if (/impuesto|ite\b/i.test(desc)) return 'tax'
  if (/servicio\s+admin|comision|comisión/i.test(desc)) return 'fee'
  return 'other'
}

function pushPurchase(
  lines: FalabellaCmrLine[],
  section: FalabellaCmrSection,
  city: string | undefined,
  date: string,
  description: string,
  purchase: number,
  installmentTotal: number,
  progress: string | undefined,
  startMonth: string | undefined,
  cuota: number,
) {
  if (cuota === 0 && purchase === 0) return
  const billed = cuota !== 0 ? cuota : purchase
  lines.push({
    section,
    date: clDateToIso(date),
    city: city && city !== 'S/I' ? city : undefined,
    description: description.replace(/\s+/g, ' ').trim(),
    holder_flag: 'T',
    purchase_amount: Math.abs(purchase),
    installment_total: installmentTotal !== 0 ? Math.abs(installmentTotal) : undefined,
    installment_progress: progress,
    installment_start_month: startMonth && !/^-?[\d.]+$/.test(startMonth) ? startMonth : undefined,
    billed_amount: billed,
    kind: 'purchase_cuota',
  })
}

const PURCHASE_SECTIONS = new Set<FalabellaCmrSection>([
  'falabella',
  'homecenter',
  'tottus',
  'pat',
  'nacional',
  'internacional',
  'otros',
])

export function parseFalabellaCmrText(text: string): FalabellaCmrStatement {
  const holder_name = match1(text, /Nombre del Titular:\s+(.+?)(?:\s{2,}|CUPON|$)/i)
  const payment_coupon = match1(text, /Cupon de Pago N°:\s+([\d.]+)/i)
  const contract_masked = match1(text, /N° de Contrato:\s+(\S+)/i)
  const card_last4 = contract_masked?.match(/(\d{4})$/)?.[1] ?? null

  const billingRaw = match1(text, /Fecha Facturación Estado de Cuenta:\s+(\d{2}\/\d{2}\/\d{4})/i)
  const billing_date = billingRaw ? clDateToIso(billingRaw) : null

  const periodMatch = text.match(
    /Per[ií]odo Facturado\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i,
  )
  const period_from = periodMatch ? clDateToIso(periodMatch[1]) : null
  const period_to = periodMatch ? clDateToIso(periodMatch[2]) : null

  const payUntilRaw =
    match1(text, /RESUMEN\s*•\s*Pagar Hasta\s+(\d{2}\/\d{2}\/\d{4})/i) ??
    match1(text, /Pagar Hasta\s+(\d{2}\/\d{2}\/\d{4})/i)
  const pay_until = payUntilRaw ? clDateToIso(payUntilRaw) : null

  const totalRaw = match1(text, /Monto Total Facturado a Pagar\s+\$?([\d.]+)/i)
  const total_due = totalRaw != null ? parseClpAmount(totalRaw) : null
  const minRaw = match1(text, /Monto m[ií]nimo a pagar\s+\$?([\d.]+)/i)
  const minimum_due = minRaw != null ? parseClpAmount(minRaw) : null

  const cupoMatch = text.match(/Cupo Total\*\s+([\d.]+|-)\s+([\d.]+|-)\s+([\d.]+|-)/i)
  const cupo_total = cupoMatch ? parseClpAmount(cupoMatch[1]) : null
  const cupo_utilizado = cupoMatch ? parseClpAmount(cupoMatch[2]) : null
  const cupo_disponible = cupoMatch ? parseClpAmount(cupoMatch[3]) : null

  const prevFromTo = text.match(
    /Per[ií]odo de facturacion anterior\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i,
  )
  const prevOpen = match1(text, /Saldo adeudado inicio per[ií]odo anterior\s+(-?[\d.]+)/i)
  const prevBilled = match1(text, /Monto facturado o a pagar per[ií]odo anterior\s+(-?[\d.]+)/i)
  const prevPaid = match1(text, /Monto pagado per[ií]odo anterior\s+(-?[\d.]+)/i)
  const prevClose = match1(text, /Saldo adeudado final periodo anterior\s+(-?[\d.]+)/i)

  const previous_period: FalabellaCmrPreviousPeriod = {
    from: prevFromTo ? clDateToIso(prevFromTo[1]) : null,
    to: prevFromTo ? clDateToIso(prevFromTo[2]) : null,
    opening_balance: prevOpen != null ? parseClpAmount(prevOpen) : null,
    billed: prevBilled != null ? parseClpAmount(prevBilled) : null,
    paid: prevPaid != null ? Math.abs(parseClpAmount(prevPaid)) : null,
    closing_balance: prevClose != null ? parseClpAmount(prevClose) : null,
  }

  const lines: FalabellaCmrLine[] = []
  let section: FalabellaCmrSection | null = null
  let inCargoBlock = false
  let inSeguroBlock = false

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.replace(/\f/g, '').trim()
    if (!trimmed || /^Sin Movimientos$/i.test(trimmed)) continue
    if (/%/.test(trimmed) && /Tasa|CAE|Per[ií]odo Facturado/i.test(trimmed)) continue

    if (/^2\.2\b/i.test(trimmed) || /Productos o servicios voluntariamente/i.test(trimmed)) {
      inSeguroBlock = true
      inCargoBlock = false
      section = 'seguro'
      continue
    }
    if (/^2\.3\b/i.test(trimmed) || /Cargos,\s*Comisiones,\s*Impuestos/i.test(trimmed)) {
      inCargoBlock = true
      inSeguroBlock = false
      section = 'cargo'
      continue
    }
    if (/^III\./i.test(trimmed) || /^IV\./i.test(trimmed) || /INFORMACI[OÓ]N DE PAGO/i.test(trimmed)) {
      inCargoBlock = false
      inSeguroBlock = false
      section = null
      continue
    }

    const sectionHit = detectPurchaseSection(trimmed)
    if (sectionHit) {
      section = sectionHit
      inCargoBlock = false
      inSeguroBlock = false
      continue
    }

    if (inSeguroBlock || inCargoBlock) {
      const ins = trimmed.match(INSURANCE_ROW)
      if (ins) {
        const cuota = parseClpAmount(ins[8] ?? ins[4])
        const desc = `${ins[2]} ${ins[3]}`.replace(/\s+/g, ' ').trim()
        lines.push({
          section: 'seguro',
          date: clDateToIso(ins[1]),
          description: desc,
          holder_flag: 'T',
          billed_amount: Math.abs(cuota),
          kind: 'insurance',
        })
        continue
      }

      let m = trimmed.match(CARGO_ROW_T)
      let noT = false
      if (!m) {
        m = trimmed.match(CARGO_ROW_NO_T)
        noT = true
      }
      if (m) {
        const date = m[1]
        const description = m[2].replace(/\s+/g, ' ').trim()
        const amount = parseClpAmount(m[3])
        const trailing = m[7] != null && m[7] !== '' ? parseClpAmount(m[7]) : null
        const billed =
          amount < 0 ? amount : trailing != null && trailing !== 0 ? trailing : Math.abs(amount)
        const kind = kindForDescription(description, amount < 0 ? amount : billed)
        const sec: FalabellaCmrSection =
          kind === 'payment' ? 'pago' : kind === 'insurance' ? 'seguro' : 'cargo'
        const signed = kind === 'payment' ? -Math.abs(billed) : Math.abs(billed)
        // Ignore $1 noise rows that appear next to real card payments
        if (kind === 'payment' && Math.abs(signed) <= 1) continue

        lines.push({
          section: sec,
          date: clDateToIso(date),
          description,
          holder_flag: noT ? undefined : 'T',
          purchase_amount: amount < 0 ? undefined : Math.abs(amount),
          billed_amount: signed,
          kind,
        })
        continue
      }
    }

    if (!section || !PURCHASE_SECTIONS.has(section)) continue

    const m = trimmed.match(PURCHASE_ROW)
    if (!m) continue

    // Reject false positives where "city" is a long prose blob
    const city = m[1].trim()
    if (city.length > 40) continue

    pushPurchase(
      lines,
      section,
      city,
      m[2],
      m[3],
      parseClpAmount(m[4]),
      parseClpAmount(m[5]),
      m[6],
      m[7],
      parseClpAmount(m[8]),
    )
  }

  const billedSum = lines
    .filter((l) => l.kind !== 'payment')
    .reduce((s, l) => s + l.billed_amount, 0)
  // Unpaid remainder from prior cycle is included in total_due but has no detalle line.
  const priorCarry = previous_period.closing_balance ?? 0
  const billed_drift = total_due != null ? billedSum + priorCarry - total_due : null
  const parse_ok =
    total_due != null &&
    billing_date != null &&
    billed_drift != null &&
    Math.abs(billed_drift) <= CLOSE_TOLERANCE

  return {
    bank: 'banco_falabella',
    product: 'cmr',
    holder_name,
    payment_coupon,
    contract_masked,
    card_last4,
    billing_date,
    period_from,
    period_to,
    pay_until,
    total_due,
    minimum_due,
    cupo_total,
    cupo_utilizado,
    cupo_disponible,
    previous_period,
    lines,
    billed_drift,
    parse_ok,
  }
}

export function isFalabellaCmrStatementText(text: string): boolean {
  return (
    /ESTADO DE CUENTA/i.test(text) &&
    /Fecha Facturación Estado de Cuenta/i.test(text) &&
    /Monto Total Facturado a Pagar/i.test(text) &&
    (/N° de Contrato:\s*999910/i.test(text) || /CMR/i.test(text) || /BancoFalabella/i.test(text))
  )
}

export { CLOSE_TOLERANCE as FALABELLA_CMR_CLOSE_TOLERANCE }
