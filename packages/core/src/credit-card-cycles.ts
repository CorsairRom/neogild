import type { SupabaseClient } from '@supabase/supabase-js'
import type { FalabellaCmrStatement } from './parsers/falabella-cmr'
import {
  creditCardBalanceFromTotalDue,
  mergeCreditCardStatementMetadata,
} from './credit-card-statement'

export const CYCLE_AMOUNT_TOLERANCE = 2
export const CYCLE_DATE_WINDOW_DAYS = 5

export type CreditCardCycleStatus = 'open' | 'partial' | 'paid' | 'overdue'

export type CreditCardCycleRow = {
  id: string
  user_id: string
  account_id: string
  billing_date: string
  period_from: string | null
  period_to: string | null
  pay_until: string | null
  total_due: number
  minimum_due: number | null
  previous_billed: number | null
  previous_paid: number | null
  cupo_total: number | null
  cupo_utilizado: number | null
  cupo_disponible: number | null
  status: CreditCardCycleStatus
  paid_amount: number
  paid_at: string | null
  bank_transaction_id: string | null
  cmr_payment_transaction_id: string | null
  source_file: string | null
}

export type CyclePaymentCandidate = {
  amount: number
  date: string
  billing_date?: string | null
  pay_until?: string | null
  status?: CreditCardCycleStatus
}

/** Neto de ciclo: lo pagado del anterior menos lo facturado ahora. */
export function cycleNetChange(
  previousPaid: number | null | undefined,
  totalDue: number | null | undefined,
): number {
  return (previousPaid ?? 0) - (totalDue ?? 0)
}

export function cyclePending(cycle: Pick<CreditCardCycleRow, 'total_due' | 'paid_amount'>): number {
  return Math.max(0, cycle.total_due - cycle.paid_amount)
}

function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Pick open cycle for a bank/email payment (amount ±2, date in billing..pay_until+5). */
export function pickCycleForPayment<T extends CyclePaymentCandidate>(
  cycles: T[],
  amount: number,
  date: string,
): T | null {
  const eligible = cycles.filter((c) => {
    if (c.status && c.status !== 'open' && c.status !== 'partial') return false
    if (Math.abs(c.amount - amount) > CYCLE_AMOUNT_TOLERANCE) return false
    const billing = c.billing_date
    if (!billing) return false
    const windowEnd = addDays(c.pay_until ?? addDays(billing, 35), CYCLE_DATE_WINDOW_DAYS)
    const windowStart = addDays(billing, -CYCLE_DATE_WINDOW_DAYS)
    return date >= windowStart && date <= windowEnd
  })
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    const amt = Math.abs(a.amount - amount) - Math.abs(b.amount - amount)
    if (amt !== 0) return amt
    const aRef = a.pay_until ?? a.billing_date ?? date
    const bRef = b.pay_until ?? b.billing_date ?? date
    return daysBetween(aRef, date) - daysBetween(bRef, date)
  })
  return eligible[0] ?? null
}

export function statusAfterPayment(totalDue: number, paidAmount: number): CreditCardCycleStatus {
  if (paidAmount + CYCLE_AMOUNT_TOLERANCE >= totalDue) return 'paid'
  if (paidAmount > 0) return 'partial'
  return 'open'
}

type LooseClient = SupabaseClient

export async function listCreditCardCycles(
  supabase: LooseClient,
  accountId: string,
): Promise<CreditCardCycleRow[]> {
  const { data, error } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .eq('account_id', accountId)
    .order('billing_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as CreditCardCycleRow[]
}

export async function getCreditCardCycleForMonth(
  supabase: LooseClient,
  accountId: string,
  month: string,
): Promise<CreditCardCycleRow | null> {
  const [y, m] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const monthEnd = new Date(y!, m!, 1).toISOString().slice(0, 10)

  const { data: monthHit, error } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .eq('account_id', accountId)
    .gte('billing_date', monthStart)
    .lt('billing_date', monthEnd)
    .order('billing_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (monthHit) return monthHit as CreditCardCycleRow

  const { data: latest, error: latestErr } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .eq('account_id', accountId)
    .order('billing_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestErr) throw latestErr
  return (latest as CreditCardCycleRow | null) ?? null
}

export async function getCreditCardCyclesByAccounts(
  supabase: LooseClient,
  accountIds: string[],
  month: string,
): Promise<Map<string, CreditCardCycleRow>> {
  const map = new Map<string, CreditCardCycleRow>()
  if (accountIds.length === 0) return map

  const { data, error } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .in('account_id', accountIds)
    .order('billing_date', { ascending: true })
  if (error) throw error

  const byAccount = new Map<string, CreditCardCycleRow[]>()
  for (const row of (data ?? []) as CreditCardCycleRow[]) {
    const list = byAccount.get(row.account_id) ?? []
    list.push(row)
    byAccount.set(row.account_id, list)
  }

  for (const [accountId, cycles] of byAccount) {
    const monthHit = [...cycles].reverse().find((c) => c.billing_date.startsWith(month))
    map.set(accountId, monthHit ?? cycles[cycles.length - 1]!)
  }
  return map
}

export type UpsertCycleInput = {
  userId: string
  accountId: string
  statement: Pick<
    FalabellaCmrStatement,
    | 'billing_date'
    | 'period_from'
    | 'period_to'
    | 'pay_until'
    | 'total_due'
    | 'minimum_due'
    | 'cupo_total'
    | 'cupo_utilizado'
    | 'cupo_disponible'
    | 'previous_period'
  >
  sourceFile?: string | null
  /** Also refresh accounts.metadata.statements + balance from latest. */
  syncAccount?: boolean
}

export async function upsertCycleFromStatement(
  supabase: LooseClient,
  input: UpsertCycleInput,
): Promise<CreditCardCycleRow | null> {
  const { statement, userId, accountId } = input
  if (!statement.billing_date || statement.total_due == null) return null

  const fields = {
    period_from: statement.period_from,
    period_to: statement.period_to,
    pay_until: statement.pay_until,
    total_due: statement.total_due,
    minimum_due: statement.minimum_due,
    previous_billed: statement.previous_period.billed,
    previous_paid: statement.previous_period.paid,
    cupo_total: statement.cupo_total,
    cupo_utilizado: statement.cupo_utilizado,
    cupo_disponible: statement.cupo_disponible,
    source_file: input.sourceFile ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .eq('account_id', accountId)
    .eq('billing_date', statement.billing_date)
    .maybeSingle()

  let cycle: CreditCardCycleRow
  if (existing) {
    const { data: updated, error } = await supabase
      .from('credit_card_cycles')
      .update(fields)
      .eq('id', (existing as CreditCardCycleRow).id)
      .select('*')
      .single()
    if (error) throw error
    cycle = updated as CreditCardCycleRow
  } else {
    const { data: inserted, error } = await supabase
      .from('credit_card_cycles')
      .insert({
        user_id: userId,
        account_id: accountId,
        billing_date: statement.billing_date,
        status: 'open',
        paid_amount: 0,
        ...fields,
      })
      .select('*')
      .single()
    if (error) throw error
    cycle = inserted as CreditCardCycleRow
  }

  // Next statement confirms prior cycle payment.
  const prevPaid = statement.previous_period.paid
  if (prevPaid != null && prevPaid > 0) {
    const { data: priors } = await supabase
      .from('credit_card_cycles')
      .select('*')
      .eq('account_id', accountId)
      .lt('billing_date', statement.billing_date)
      .order('billing_date', { ascending: false })
      .limit(5)

    const prior = ((priors ?? []) as CreditCardCycleRow[]).find(
      (c) => Math.abs(c.total_due - prevPaid) <= CYCLE_AMOUNT_TOLERANCE,
    ) ?? ((priors ?? []) as CreditCardCycleRow[])[0]

    if (prior && prior.status !== 'paid') {
      await supabase
        .from('credit_card_cycles')
        .update({
          paid_amount: Math.max(prior.paid_amount, prevPaid),
          paid_at: prior.paid_at ?? statement.billing_date,
          status: statusAfterPayment(prior.total_due, Math.max(prior.paid_amount, prevPaid)),
          previous_paid: prevPaid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prior.id)
    }
  }

  if (input.syncAccount) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('metadata')
      .eq('id', accountId)
      .single()

    const meta = mergeCreditCardStatementMetadata(
      (acc?.metadata as Record<string, unknown> | null) ?? null,
      {
        billing_date: statement.billing_date,
        total_due: statement.total_due,
        minimum_due: statement.minimum_due,
        pay_until: statement.pay_until,
        cupo_total: statement.cupo_total,
        cupo_utilizado: statement.cupo_utilizado,
        cupo_disponible: statement.cupo_disponible,
        file: input.sourceFile ?? null,
      },
    )
    const debt = creditCardBalanceFromTotalDue(statement.total_due)
    await supabase
      .from('accounts')
      .update({
        metadata: meta,
        ...(debt != null
          ? {
              balance: debt,
              last_statement_balance: debt,
              last_statement_date: statement.billing_date,
            }
          : {}),
      })
      .eq('id', accountId)
  }

  return cycle
}

export type MatchCyclePaymentInput = {
  userId: string
  amount: number
  date: string
  accountId?: string | null
  bankTransactionId?: string | null
  cmrPaymentTransactionId?: string | null
}

export async function matchCyclePayment(
  supabase: LooseClient,
  input: MatchCyclePaymentInput,
): Promise<{ matched: boolean; cycle?: CreditCardCycleRow }> {
  const { data, error } = await supabase.rpc('match_credit_card_cycle_payment', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_date: input.date,
    p_bank_transaction_id: input.bankTransactionId ?? null,
    p_cmr_payment_transaction_id: input.cmrPaymentTransactionId ?? null,
    p_account_id: input.accountId ?? null,
  })
  if (error) throw error

  const result = data as {
    matched?: boolean
    cycle_id?: string
  } | null

  if (!result?.matched || !result.cycle_id) return { matched: false }

  const { data: cycle, error: cycleErr } = await supabase
    .from('credit_card_cycles')
    .select('*')
    .eq('id', result.cycle_id)
    .single()
  if (cycleErr) throw cycleErr
  return { matched: true, cycle: cycle as CreditCardCycleRow }
}
