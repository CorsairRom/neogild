/** Bank notification senders — used for IMAP client-side filtering (ADR-012). */
export const KNOWN_SENDERS = [
  'enviodigital@bancochile.cl',
  'serviciodetransferencias@bancochile.cl',
  'reply@info.bice.cl',
  'info@mercadopago.com',
  'no-reply@tenpo.cl',
  'contacto@bci.cl',
  'notificaciones@correo.bancoestado.cl',
  'noreply@correo.bancoestado.cl',
  'notificaciones@cl.bancofalabella.com',
] as const

export function isKnownSender(from: string): boolean {
  const lower = from.toLowerCase()
  return KNOWN_SENDERS.some((sender) => lower.includes(sender))
}
