import { describe, expect, it } from 'vitest'
import {
  cashAccountsActualBalance,
  cashAccountsMonthNet,
  monthNetFromActivity,
} from './account-balances'

describe('monthNetFromActivity', () => {
  it('incluye transferencias en el neto del mes', () => {
    expect(
      monthNetFromActivity({
        income: 100,
        expense: 40,
        transfer_in: 50,
        transfer_out: 30,
      }),
    ).toEqual({ monthIn: 150, monthOut: 70, monthNet: 80 })
  })

  it('tolera activity ausente', () => {
    expect(monthNetFromActivity(null)).toEqual({
      monthIn: 0,
      monthOut: 0,
      monthNet: 0,
    })
  })
})

describe('cashAccountsMonthNet', () => {
  it('solo suma debit/cash, ignora credit_card', () => {
    const accounts = [
      { id: 'a', subtype: 'debit' },
      { id: 'b', subtype: 'credit_card' },
      { id: 'c', subtype: 'cash' },
    ]
    const activity = [
      {
        account_id: 'a',
        income: 0,
        expense: 10,
        transfer_in: 100,
        transfer_out: 0,
      },
      {
        account_id: 'b',
        income: 0,
        expense: 999,
        transfer_in: 0,
        transfer_out: 0,
      },
      {
        account_id: 'c',
        income: 5,
        expense: 0,
        transfer_in: 0,
        transfer_out: 0,
      },
    ]
    expect(cashAccountsMonthNet(accounts, activity)).toBe(95)
    expect(
      cashAccountsActualBalance([
        { subtype: 'debit', balance: 10 },
        { subtype: 'credit_card', balance: -500 },
        { subtype: 'cash', balance: 3 },
      ]),
    ).toBe(13)
  })
})
