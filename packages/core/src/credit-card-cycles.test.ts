import { describe, expect, it } from 'vitest'
import {
  cycleNetChange,
  cyclePending,
  pickCycleForPayment,
  statusAfterPayment,
} from './credit-card-cycles'

describe('cycleNetChange', () => {
  it('junio: pagado anterior 440140 − facturado 479140', () => {
    expect(cycleNetChange(440140, 479140)).toBe(-39000)
  })
})

describe('pickCycleForPayment', () => {
  const cycles = [
    {
      amount: 440140,
      date: '2026-05-24',
      billing_date: '2026-05-24',
      pay_until: '2026-06-10',
      status: 'open' as const,
    },
    {
      amount: 479140,
      date: '2026-06-24',
      billing_date: '2026-06-24',
      pay_until: '2026-07-10',
      status: 'open' as const,
    },
  ]

  it('empareja pago mayo 440140 con ciclo mayo', () => {
    const hit = pickCycleForPayment(cycles, 440140, '2026-05-29')
    expect(hit?.billing_date).toBe('2026-05-24')
  })

  it('empareja cargo BCH 01-06 con ciclo mayo', () => {
    const hit = pickCycleForPayment(cycles, 440140, '2026-06-01')
    expect(hit?.billing_date).toBe('2026-05-24')
  })

  it('no empareja 479140 contra ciclo mayo', () => {
    expect(pickCycleForPayment(cycles, 479140, '2026-06-01')).toBeNull()
  })

  it('junio sigue open sin pago', () => {
    expect(pickCycleForPayment(cycles, 479140, '2026-07-05')?.billing_date).toBe(
      '2026-06-24',
    )
  })
})

describe('statusAfterPayment', () => {
  it('paid cuando cubre total_due', () => {
    expect(statusAfterPayment(440140, 440140)).toBe('paid')
    expect(statusAfterPayment(440140, 440139)).toBe('paid')
  })

  it('partial cuando abona menos', () => {
    expect(statusAfterPayment(479140, 100000)).toBe('partial')
  })
})

describe('cyclePending', () => {
  it('resta lo pagado', () => {
    expect(cyclePending({ total_due: 479140, paid_amount: 0 })).toBe(479140)
    expect(cyclePending({ total_due: 479140, paid_amount: 479140 })).toBe(0)
  })
})
