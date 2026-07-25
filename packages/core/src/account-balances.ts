import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type TypedClient = SupabaseClient<Database>

export type AccountBalanceRow = {
  id: string
  name: string
  subtype: string
  type: 'asset' | 'liability'
  balance: number
  currency: string
  metadata: Record<string, unknown> | null
  last_statement_balance: number | null
  last_statement_date: string | null
}

export type AccountMonthActivity = {
  account_id: string
  income: number
  expense: number
  transfer_in: number
  transfer_out: number
}

export async function getPersonalAccountBalances(
  supabase: TypedClient,
): Promise<AccountBalanceRow[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select(
      'id, name, subtype, type, balance, currency, metadata, last_statement_balance, last_statement_date',
    )
    .eq('entity', 'personal')
    .eq('is_archived', false)
    .order('name')
  if (error) throw error
  return (data ?? []) as AccountBalanceRow[]
}

export async function getAccountMonthActivity(
  supabase: TypedClient,
  month: string,
): Promise<AccountMonthActivity[]> {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(y, m, 1).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, type, amount')
    .gte('date', start)
    .lt('date', end)

  if (error) throw error

  const map = new Map<string, AccountMonthActivity>()

  for (const row of data ?? []) {
    if (!row.account_id) continue
    const cur = map.get(row.account_id) ?? {
      account_id: row.account_id,
      income: 0,
      expense: 0,
      transfer_in: 0,
      transfer_out: 0,
    }

    if (row.type === 'income' || row.type === 'refund') {
      cur.income += row.amount
    } else if (row.type === 'expense') {
      cur.expense += row.amount
    } else if (row.type === 'transfer') {
      if (row.amount > 0) cur.transfer_in += row.amount
      else cur.transfer_out += Math.abs(row.amount)
    }

    map.set(row.account_id, cur)
  }

  return [...map.values()]
}

export async function rebuildAccountBalances(
  supabase: TypedClient,
  userId?: string,
): Promise<{ accounts_updated: number }> {
  const client = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }
  const { data, error } = await client.rpc('rebuild_account_balances', userId ? { p_user_id: userId } : {})
  if (error) throw error
  return data as { accounts_updated: number }
}
