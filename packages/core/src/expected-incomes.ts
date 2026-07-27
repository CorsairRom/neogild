import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpectedIncomeAttribution = 'labor_month' | 'cash_month'

export type ExpectedIncomeRow = {
  id: string
  user_id: string
  name: string
  amount: number
  match_pattern: string | null
  typical_day: number | null
  attribution: ExpectedIncomeAttribution
  account_id: string | null
  is_active: boolean
  sort_order: number
}

export type ExpectedIncomeMonthStatus = 'confirmed' | 'pending' | 'missing'

export type ExpectedIncomeMonthItem = {
  income: ExpectedIncomeRow
  status: ExpectedIncomeMonthStatus
  expected_amount: number
  confirmed_amount: number | null
  matched_transaction_id: string | null
  matched_date: string | null
  matched_description: string | null
}

export type ExpectedIncomesMonthSummary = {
  month: string
  items: ExpectedIncomeMonthItem[]
  expected_total: number
  confirmed_total: number
  pending_total: number
}

type LooseClient = SupabaseClient

const AMOUNT_TOLERANCE_RATIO = 0.03 // 3%
const AMOUNT_TOLERANCE_FLOOR = 5000

function amountClose(expected: number, actual: number): boolean {
  const tol = Math.max(AMOUNT_TOLERANCE_FLOOR, Math.abs(expected) * AMOUNT_TOLERANCE_RATIO)
  return Math.abs(expected - actual) <= tol
}

/** Match window for a labor month YYYY-MM: calendar month through mid next month. */
export function laborMonthMatchWindow(month: string): { start: string; endExclusive: string } {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const next = m === 12 ? { y: y! + 1, m: 1 } : { y: y!, m: m! + 1 }
  const endExclusive = `${String(next.y).padStart(4, '0')}-${String(next.m).padStart(2, '0')}-16`
  return { start, endExclusive }
}

export function cashMonthMatchWindow(month: string): { start: string; endExclusive: string } {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const endExclusive =
    m === 12
      ? `${y! + 1}-01-01`
      : `${String(y).padStart(4, '0')}-${String(m! + 1).padStart(2, '0')}-01`
  return { start, endExclusive }
}

type CandidateTx = {
  id: string
  date: string
  amount: number
  description: string | null
  account_id: string
}

export function pickMatchForExpected(
  income: Pick<ExpectedIncomeRow, 'amount' | 'match_pattern' | 'account_id'>,
  candidates: CandidateTx[],
  usedIds: Set<string>,
): CandidateTx | null {
  const pattern = income.match_pattern?.trim()
  const eligible = candidates.filter((t) => {
    if (usedIds.has(t.id)) return false
    if (income.account_id && t.account_id !== income.account_id) return false
    if (!amountClose(income.amount, t.amount)) return false
    if (pattern) {
      const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (!re.test(t.description ?? '')) return false
    }
    return true
  })
  if (eligible.length === 0) return null
  eligible.sort(
    (a, b) => Math.abs(a.amount - income.amount) - Math.abs(b.amount - income.amount),
  )
  return eligible[0] ?? null
}

export async function listExpectedIncomes(
  supabase: LooseClient,
  opts?: { activeOnly?: boolean },
): Promise<ExpectedIncomeRow[]> {
  let q = supabase.from('expected_incomes').select('*').order('sort_order').order('created_at')
  if (opts?.activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount),
    attribution: (row.attribution === 'cash_month' ? 'cash_month' : 'labor_month') as ExpectedIncomeAttribution,
  }))
}

export async function createExpectedIncome(
  supabase: LooseClient,
  userId: string,
  input: {
    name: string
    amount: number
    match_pattern?: string | null
    typical_day?: number | null
    attribution?: ExpectedIncomeAttribution
    account_id?: string | null
    sort_order?: number
  },
): Promise<ExpectedIncomeRow> {
  const { data, error } = await supabase
    .from('expected_incomes')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      amount: input.amount,
      match_pattern: input.match_pattern?.trim() || null,
      typical_day: input.typical_day ?? null,
      attribution: input.attribution ?? 'labor_month',
      account_id: input.account_id ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ExpectedIncomeRow
}

export async function updateExpectedIncome(
  supabase: LooseClient,
  id: string,
  patch: Partial<{
    name: string
    amount: number
    match_pattern: string | null
    typical_day: number | null
    attribution: ExpectedIncomeAttribution
    account_id: string | null
    is_active: boolean
    sort_order: number
  }>,
): Promise<ExpectedIncomeRow> {
  const { data, error } = await supabase
    .from('expected_incomes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ExpectedIncomeRow
}

export async function deleteExpectedIncome(supabase: LooseClient, id: string): Promise<void> {
  const { error } = await supabase.from('expected_incomes').delete().eq('id', id)
  if (error) throw error
}

/** Cash-only income/expense for debit|cash accounts in a month (from activity rows). */
export function cashIncomeExpenseFromActivity(
  accounts: Array<{ id: string; subtype: string }>,
  activity: Array<{
    account_id: string
    income: number
    expense: number
  }>,
): { income: number; expense: number } {
  const cashIds = new Set(
    accounts.filter((a) => a.subtype === 'debit' || a.subtype === 'cash').map((a) => a.id),
  )
  let income = 0
  let expense = 0
  for (const row of activity) {
    if (!cashIds.has(row.account_id)) continue
    income += row.income
    expense += row.expense
  }
  return { income, expense }
}

export async function getExpectedIncomesMonthSummary(
  supabase: LooseClient,
  month: string,
): Promise<ExpectedIncomesMonthSummary> {
  const incomes = await listExpectedIncomes(supabase, { activeOnly: true })

  const windows = {
    labor_month: laborMonthMatchWindow(month),
    cash_month: cashMonthMatchWindow(month),
  }
  const globalStart = [windows.labor_month.start, windows.cash_month.start].sort()[0]!
  const globalEnd = [windows.labor_month.endExclusive, windows.cash_month.endExclusive].sort()[1]!

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, date, amount, description, account_id, type')
    .gte('date', globalStart)
    .lt('date', globalEnd)
    .in('type', ['income', 'refund'])
    .order('date')
  if (error) throw error

  const used = new Set<string>()
  const items: ExpectedIncomeMonthItem[] = []

  for (const income of incomes) {
    const win = windows[income.attribution] ?? windows.labor_month
    const candidates: CandidateTx[] = ((txs ?? []) as CandidateTx[])
      .filter((t) => t.date >= win.start && t.date < win.endExclusive)
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        description: t.description,
        account_id: t.account_id,
      }))

    const hit = pickMatchForExpected(income, candidates, used)
    if (hit) {
      used.add(hit.id)
      items.push({
        income,
        status: 'confirmed',
        expected_amount: Number(income.amount),
        confirmed_amount: hit.amount,
        matched_transaction_id: hit.id,
        matched_date: hit.date,
        matched_description: hit.description,
      })
    } else {
      // If we're still before the typical end of the match window, pending; else missing.
      const today = new Date().toISOString().slice(0, 10)
      const status: ExpectedIncomeMonthStatus =
        today < win.endExclusive ? 'pending' : 'missing'
      items.push({
        income,
        status,
        expected_amount: Number(income.amount),
        confirmed_amount: null,
        matched_transaction_id: null,
        matched_date: null,
        matched_description: null,
      })
    }
  }

  const expected_total = items.reduce((s, i) => s + i.expected_amount, 0)
  const confirmed_total = items.reduce((s, i) => s + (i.confirmed_amount ?? 0), 0)
  const pending_total = items
    .filter((i) => i.status !== 'confirmed')
    .reduce((s, i) => s + i.expected_amount, 0)

  return { month, items, expected_total, confirmed_total, pending_total }
}
