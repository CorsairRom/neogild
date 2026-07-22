import { describe, expect, it } from 'vitest'
import { isForwarded, unwrapForward } from './forward'
import type { RawEmail } from './parsers'

const base: RawEmail = {
  id: 'msg1',
  from: 'me@gmail.com',
  subject: 'Fwd: Compra con Tarjeta',
  date: '2026-07-22T10:00:00.000Z',
  body: `
---------- Forwarded message ---------
From: enviodigital@bancochile.cl
Date: Mon, 8 Jul 2026 21:15:00 -0400
Subject: Compra con Tarjeta de Crédito

compra por $9.900 con Tarjeta de Crédito ****1234 en CRUNCHYROLL el 08/07/2026 21:15
`,
}

describe('forward', () => {
  it('detects forwarded emails', () => {
    expect(isForwarded(base)).toBe(true)
  })

  it('unwraps inner bank sender and movement date', () => {
    const inner = unwrapForward(base)
    expect(inner.from).toContain('bancochile.cl')
    expect(inner.subject).toContain('Compra')
    expect(inner.date).toContain('2026-07-08')
  })
})
