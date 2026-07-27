import { describe, expect, it } from 'vitest'
import {
  creditCardBalanceFromTotalDue,
  creditCardStatementFromMetadata,
  mergeCreditCardStatementMetadata,
} from './credit-card-statement'

describe('mergeCreditCardStatementMetadata', () => {
  it('acumula estados y deja el más reciente arriba', () => {
    let meta = mergeCreditCardStatementMetadata(null, {
      billing_date: '2026-05-24',
      total_due: 440140,
      minimum_due: 70110,
      pay_until: '2026-06-10',
      cupo_total: 1100000,
      cupo_utilizado: 1128780,
      cupo_disponible: 0,
      file: 'may.pdf',
    })
    meta = mergeCreditCardStatementMetadata(meta, {
      billing_date: '2026-06-24',
      total_due: 479140,
      minimum_due: 85550,
      pay_until: '2026-07-10',
      cupo_total: 1100000,
      cupo_utilizado: 1138565,
      cupo_disponible: 0,
      file: 'jun.pdf',
    })

    expect(meta.total_due).toBe(479140)
    expect(meta.minimum_due).toBe(85550)
    expect(meta.pay_until).toBe('2026-07-10')
    expect(Array.isArray(meta.statements)).toBe(true)
    expect((meta.statements as unknown[]).length).toBe(2)
  })
})

describe('creditCardStatementFromMetadata', () => {
  it('elige el estado del mes pedido', () => {
    const meta = mergeCreditCardStatementMetadata(
      mergeCreditCardStatementMetadata(null, {
        billing_date: '2026-05-24',
        total_due: 440140,
        minimum_due: 70110,
        pay_until: '2026-06-10',
        cupo_total: null,
        cupo_utilizado: null,
        cupo_disponible: null,
      }),
      {
        billing_date: '2026-06-24',
        total_due: 479140,
        minimum_due: 85550,
        pay_until: '2026-07-10',
        cupo_total: null,
        cupo_utilizado: null,
        cupo_disponible: null,
      },
    )

    expect(creditCardStatementFromMetadata(meta, '2026-05')?.total_due).toBe(440140)
    expect(creditCardStatementFromMetadata(meta, '2026-06')?.minimum_due).toBe(85550)
    expect(creditCardStatementFromMetadata(meta, '2026-07')?.total_due).toBe(479140)
  })
})

describe('creditCardBalanceFromTotalDue', () => {
  it('guarda deuda como negativo', () => {
    expect(creditCardBalanceFromTotalDue(479140)).toBe(-479140)
  })
})
