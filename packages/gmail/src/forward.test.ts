import { describe, expect, it } from 'vitest'
import { isForwarded, unwrapForward } from './forward'
import { parseEmail } from './parsers'
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

const outlookForward: RawEmail = {
  id: 'msg2',
  from: 'rromero@heligrafics.net',
  subject: 'RV: Cargo en Cuenta',
  date: '2026-07-23T21:54:00.000Z',
  body: `
fiy

Reenvió este mensaje el Jue 23/07/2026 17:54

De: enviodigital@bancochile.cl
Enviado: martes, 14 de julio de 2026 11:13
Para: Richard Romero <rromero@heligrafics.net>
Asunto: Cargo en Cuenta

Richard Alexis Romero Moore:
Te informamos que se ha realizado una compra por $5.081 con cargo a Cuenta ****7210 en Spotify P44932218 el 14/07/2026 11:13.
Revisa Saldos y Movimientos en App Mi Banco o Banco en Línea.
`,
}

describe('forward', () => {
  it('detects forwarded emails', () => {
    expect(isForwarded(base)).toBe(true)
  })

  it('detects Outlook RV: forwards', () => {
    expect(isForwarded(outlookForward)).toBe(true)
  })

  it('unwraps inner bank sender and movement date', () => {
    const inner = unwrapForward(base)
    expect(inner.from).toContain('bancochile.cl')
    expect(inner.subject).toContain('Compra')
    expect(inner.date).toContain('2026-07-08')
  })

  it('unwraps Outlook Spanish forward and parses cargo cuenta', () => {
    const inner = unwrapForward(outlookForward)
    expect(inner.from).toContain('enviodigital@bancochile.cl')
    expect(inner.subject).toBe('Cargo en Cuenta')
    expect(inner.date).toContain('2026-07-14')

    const parsed = parseEmail(outlookForward)
    expect(parsed).not.toBe('ignore')
    expect(parsed).not.toBeNull()
    if (parsed && parsed !== 'ignore') {
      expect(parsed.source).toBe('bancochile_cargo_cuenta')
      expect(parsed.amount).toBe(5081)
      expect(parsed.merchant).toBe('Spotify P44932218')
      expect(parsed.account_hint).toBe('7210')
    }
  })
})
