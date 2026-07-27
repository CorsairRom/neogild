import { describe, expect, it } from 'vitest'
import {
  cashIncomeExpenseFromActivity,
  cashMonthMatchWindow,
  laborMonthMatchWindow,
  pickMatchForExpected,
} from './expected-incomes'

describe('match windows', () => {
  it('labor month spans into next calendar month', () => {
    const w = laborMonthMatchWindow('2026-05')
    expect(w.start).toBe('2026-05-01')
    expect(w.endExclusive).toBe('2026-06-16')
  })

  it('cash month is calendar bounds', () => {
    expect(cashMonthMatchWindow('2026-05')).toEqual({
      start: '2026-05-01',
      endExclusive: '2026-06-01',
    })
  })
})

describe('pickMatchForExpected', () => {
  const candidates = [
    {
      id: 'a',
      date: '2026-06-01',
      amount: 1909624,
      description: 'TRASPASO DE:HELIGRAFICS CHILE SPA',
      account_id: 'bch',
    },
    {
      id: 'b',
      date: '2026-05-18',
      amount: 119510,
      description: 'TEF DE YALEY',
      account_id: 'be',
    },
  ]

  it('matches Heligrafics by pattern and amount', () => {
    const hit = pickMatchForExpected(
      { amount: 1910000, match_pattern: 'HELIGRAFICS', account_id: null },
      candidates,
      new Set(),
    )
    expect(hit?.id).toBe('a')
  })

  it('does not reuse a matched tx', () => {
    const used = new Set(['a'])
    expect(
      pickMatchForExpected(
        { amount: 1910000, match_pattern: 'HELIGRAFICS', account_id: null },
        candidates,
        used,
      ),
    ).toBeNull()
  })
})

describe('cashIncomeExpenseFromActivity', () => {
  it('ignores credit cards', () => {
    const r = cashIncomeExpenseFromActivity(
      [
        { id: '1', subtype: 'debit' },
        { id: '2', subtype: 'credit_card' },
      ],
      [
        { account_id: '1', income: 100, expense: 50 },
        { account_id: '2', income: 0, expense: 999 },
      ],
    )
    expect(r).toEqual({ income: 100, expense: 50 })
  })
})
