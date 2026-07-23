import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { getMonthlyBuckets } from './buckets'

type TypedClient = SupabaseClient<Database>

export type CategorySlice = {
  category: string
  label: string
  amount: number
}

export type DailySpend = {
  date: string
  day: number
  amount: number
}

export type TrendPoint = {
  month: string
  label: string
  ingresos: number
  gastos: number
  disponible: number
}

function monthRange(month: string): { start: string; end: string } {
  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const start = `${month}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]!
  return { start, end }
}

function monthLabel(month: string): string {
  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  return new Intl.DateTimeFormat('es-CL', { month: 'short', year: '2-digit' }).format(
    new Date(y, m - 1, 1),
  )
}

function shiftMonth(month: string, delta: number): string {
  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Expense totals grouped by category for a calendar month. */
export async function getCategoryBreakdown(
  supabase: TypedClient,
  month: string,
  categoryLabels: Map<string, string>,
): Promise<CategorySlice[]> {
  const { start, end } = monthRange(month)
  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount, type')
    .gte('date', start)
    .lte('date', end)
    .in('type', ['expense', 'refund'])
    .not('amount', 'is', null)
  if (error) throw error

  const totals = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.category) {
      const key = '__uncategorized__'
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(row.amount))
      continue
    }
    totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(row.amount))
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      label:
        category === '__uncategorized__'
          ? 'Sin categoría'
          : (categoryLabels.get(category) ?? category),
      amount,
    }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

/** Daily expense totals within a month (for bar chart). */
export async function getDailyExpenses(
  supabase: TypedClient,
  month: string,
): Promise<DailySpend[]> {
  const { start, end } = monthRange(month)
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .gte('date', start)
    .lte('date', end)
    .in('type', ['expense', 'refund'])
  if (error) throw error

  const byDay = new Map<number, number>()
  for (const row of data ?? []) {
    const day = Number(row.date.split('-')[2])
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(row.amount))
  }

  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const daysInMonth = new Date(y, m, 0).getDate()

  const result: DailySpend[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    result.push({
      date: `${month}-${String(d).padStart(2, '0')}`,
      day: d,
      amount: byDay.get(d) ?? 0,
    })
  }
  return result
}

/** Last N months bucket totals for trend chart. */
export async function getMonthlyTrend(
  supabase: TypedClient,
  anchorMonth: string,
  count = 6,
): Promise<TrendPoint[]> {
  const points: TrendPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const month = shiftMonth(anchorMonth, -i)
    const buckets = await getMonthlyBuckets(supabase, { month })
    const gastos =
      buckets.necesidades + buckets.consumo + buckets.ahorro + buckets.por_categorizar
    points.push({
      month,
      label: monthLabel(month),
      ingresos: buckets.income,
      gastos,
      disponible: buckets.disponible,
    })
  }
  return points
}

export function currentMonthIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthParam(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value
  return currentMonthIso()
}

export { shiftMonth, monthLabel }
