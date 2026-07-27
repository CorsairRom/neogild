import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseFalabellaCmrText } from './falabella-cmr'

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/falabella-cmr')

function load(name: string) {
  return readFileSync(join(FIX, name), 'utf8')
}

describe('parseFalabellaCmrText', () => {
  it('junio 2026: total_due, payment, cierre y card_last4', () => {
    const s = parseFalabellaCmrText(load('2026-06-24.txt'))
    expect(s.billing_date).toBe('2026-06-24')
    expect(s.total_due).toBe(479140)
    expect(s.minimum_due).toBe(85550)
    expect(s.card_last4).toBe('5567')
    expect(s.period_from).toBe('2026-05-25')
    expect(s.period_to).toBe('2026-06-24')
    expect(s.cupo_total).toBe(1100000)
    expect(s.cupo_utilizado).toBe(1138565)

    const payments = s.lines.filter((l) => l.kind === 'payment')
    expect(payments).toHaveLength(1)
    expect(payments[0].billed_amount).toBe(-440140)
    expect(payments[0].date).toBe('2026-05-29')

    expect(s.previous_period.billed).toBe(440140)
    expect(s.previous_period.paid).toBe(440140)
    expect(s.previous_period.closing_balance).toBe(0)

    const billed = s.lines
      .filter((l) => l.kind !== 'payment')
      .reduce((a, l) => a + l.billed_amount, 0)
    const carry = s.previous_period.closing_balance ?? 0
    expect(Math.abs(billed + carry - 479140)).toBeLessThanOrEqual(20)
    expect(s.parse_ok).toBe(true)

    // Must use cuota, not full purchase (Falabella.com 582880 → cuota ~58624)
    const falabella = s.lines.find((l) => /Falabella\.com/i.test(l.description))
    expect(falabella).toBeTruthy()
    expect(falabella!.purchase_amount).toBe(582880)
    expect(falabella!.billed_amount).toBe(58624)
  })

  it('abril 2026: pago parcial 554873 y saldo anterior 77', () => {
    const s = parseFalabellaCmrText(load('2026-04-24.txt'))
    expect(s.billing_date).toBe('2026-04-24')
    expect(s.total_due).toBe(546690)
    expect(s.previous_period.billed).toBe(554950)
    expect(s.previous_period.paid).toBe(554873)
    expect(s.previous_period.closing_balance).toBe(77)

    const payments = s.lines.filter((l) => l.kind === 'payment')
    expect(payments).toHaveLength(1)
    expect(payments[0].billed_amount).toBe(-554873)

    const billed = s.lines
      .filter((l) => l.kind !== 'payment')
      .reduce((a, l) => a + l.billed_amount, 0)
    const carry = s.previous_period.closing_balance ?? 0
    expect(carry).toBe(77)
    expect(Math.abs(billed + carry - 546690)).toBeLessThanOrEqual(20)
    expect(s.parse_ok).toBe(true)
  })

  it('diciembre 2025: total_due y un pago', () => {
    const s = parseFalabellaCmrText(load('2025-12-24.txt'))
    expect(s.billing_date).toBe('2025-12-24')
    expect(s.total_due).toBe(249870)
    expect(s.card_last4).toBe('5567')
    const payments = s.lines.filter((l) => l.kind === 'payment')
    expect(payments.length).toBeGreaterThanOrEqual(1)
    expect(payments[0].billed_amount).toBeLessThan(0)
    expect(s.parse_ok).toBe(true)
  })

  it('junio 2026 pdf.js layout: montos en líneas separadas de las etiquetas', () => {
    const s = parseFalabellaCmrText(load('2026-06-24.pdfjs.txt'))
    expect(s.billing_date).toBe('2026-06-24')
    expect(s.total_due).toBe(479140)
    expect(s.minimum_due).toBe(85550)
    expect(s.pay_until).toBe('2026-07-10')
    expect(s.cupo_utilizado).toBe(1138565)
    // Must not confuse date day "10" with minimum_due
    expect(s.minimum_due).not.toBe(10)
    expect(s.parse_ok).toBe(true)
  })
})
