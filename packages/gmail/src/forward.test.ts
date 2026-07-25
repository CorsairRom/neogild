import { describe, expect, it } from 'vitest'
import { isForwarded, unwrapForward } from './forward'
import { cartolaSourceForEmail, isCartolaEmail, parseEmail } from './parsers'
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

const hotmailHtmlForward: RawEmail = {
  id: 'msg4',
  from: 'richard.romero@hotmail.cl',
  subject: 'RV: Notificación de compra - BancoEstado',
  date: '2026-07-23T22:00:00.000Z',
  body: `<html><body>
<hr>
<b>De:</b> BancoEstado &lt;notificaciones@correo.bancoestado.cl&gt;<br>
<b>Enviado:</b> martes, 21 de julio de 2026 18:47<br>
<b>Para:</b> richard.romero@hotmail.cl<br>
<b>Asunto:</b> Notificación de compra - BancoEstado
Se ha realizado una compra por $ 21.388 en JUMBO MALL CENTRO CONC CONCEPCION CL asociado a su tarjeta de Débito terminada en **** 1958 el día 21/07/2026 a las 18:47 hrs.
</body></html>`,
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

  it('unwraps Outlook English Fw: cartola and detects BancoEstado source', () => {
    const cartolaForward: RawEmail = {
      id: 'msg3',
      from: 'richard.romero@hotmail.cl',
      subject: 'Fw: Cartola de CuentaRUT',
      date: '2026-07-23T22:22:00.000Z',
      body: `
Get Outlook for Android

From: BancoEstado <bancoestado@correo.bancoestado.cl>
Sent: Thursday, 23 July 2026 05:02:04
To: richard.romero@hotmail.cl
Subject: Cartola de CuentaRUT

Estimado(a): ROMERO MOORE RICHARD ALEXIS

Junto con saludarlo(a), adjuntamos cartola donde podrá conocer los saldos y movimientos
de su CuentaRUT en BancoEstado.
`,
    }

    expect(isForwarded(cartolaForward)).toBe(true)
    const inner = unwrapForward(cartolaForward)
    expect(inner.from).toContain('bancoestado@correo.bancoestado.cl')
    expect(inner.subject).toBe('Cartola de CuentaRUT')
    expect(inner.date).toContain('2026-07-23')

    expect(isCartolaEmail(inner)).toBe(true)
    expect(cartolaSourceForEmail(inner)).toBe('bancoestado_cartola')
  })

  it('unwraps Hotmail HTML RV: forward from BancoEstado', () => {
    const inner = unwrapForward(hotmailHtmlForward)
    expect(inner.from).toContain('notificaciones@correo.bancoestado.cl')
    expect(inner.subject).toContain('Notificación de compra')

    const parsed = parseEmail(hotmailHtmlForward)
    expect(parsed).not.toBe('ignore')
    if (parsed && parsed !== 'ignore') {
      expect(parsed.source).toBe('bancoestado_debito')
      expect(parsed.amount).toBe(21388)
    }
  })
})
