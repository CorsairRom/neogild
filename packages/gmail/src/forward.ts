import type { RawEmail } from './parsers'

const FORWARD_SUBJECT = /^(?:fwd|fw|rv|reenviado|reenv[ií]o)\s*:/i
const FORWARD_BLOCK = /-{5,}\s*(?:forwarded message|mensaje reenviado)\s*-{5,}/i
const OUTLOOK_FORWARD = /reenvi[oó]\s+(?:este\s+)?mensaje/i

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
}

export function isForwarded(email: RawEmail): boolean {
  if (FORWARD_SUBJECT.test(email.subject.trim())) return true
  const plain = stripTags(email.body)
  if (FORWARD_BLOCK.test(plain)) return true
  return OUTLOOK_FORWARD.test(plain)
}

/** Extract inner bank email from a Gmail forward wrapper. */
export function unwrapForward(email: RawEmail): RawEmail {
  if (!isForwarded(email)) return email

  const plain = stripTags(email.body)

  const from =
    plain.match(/^From:\s*(.+)$/im)?.[1]?.trim() ??
    plain.match(/^De:\s*(.+)$/im)?.[1]?.trim() ??
    email.from

  const subject =
    plain.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ??
    plain.match(/^Asunto:\s*(.+)$/im)?.[1]?.trim() ??
    email.subject.replace(FORWARD_SUBJECT, '').trim()

  const dateHeader =
    plain.match(/^Date:\s*(.+)$/im)?.[1]?.trim() ??
    plain.match(/^Fecha:\s*(.+)$/im)?.[1]?.trim() ??
    plain.match(/^Enviado:\s*(.+)$/im)?.[1]?.trim()

  const bodyMatch = plain.match(FORWARD_BLOCK)
  let body = plain
  if (bodyMatch?.index !== undefined) {
    body = plain.slice(bodyMatch.index + bodyMatch[0].length).trim()
  } else {
    // Outlook / Apple Mail: De/Enviado/Para/Asunto block without dashed separator
    const outlookBody = plain.match(
      /(?:^|\n)Asunto:\s*.+\r?\n([\s\S]+)$/im,
    )?.[1]
    if (outlookBody) body = outlookBody.trim()
  }

  const movementDate =
    body.match(/\bel\s+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?)/i)?.[1] ??
    body.match(/(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?)/)?.[1]

  let emailDate = email.date
  if (movementDate) {
    const [d, m, y, ...time] = movementDate.split(/[\s/]+/)
    const iso = `${y}-${m}-${d}T${time[0] ?? '12:00'}:00.000Z`
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) emailDate = parsed.toISOString()
  } else if (dateHeader) {
    const parsed = new Date(dateHeader)
    if (!Number.isNaN(parsed.getTime())) emailDate = parsed.toISOString()
  }

  return {
    id: email.id,
    from,
    subject,
    date: emailDate,
    body,
  }
}
