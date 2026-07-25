import type { RawEmail } from './parsers'

const FORWARD_SUBJECT = /^(?:fwd|fw|rv|reenviado|reenv[ií]o)\s*:/i
const FORWARD_BLOCK = /-{5,}\s*(?:forwarded message|mensaje reenviado)\s*-{5,}/i
const OUTLOOK_FORWARD = /reenvi[oó]\s+(?:este\s+)?mensaje/i

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
}

/** HTML → plain text preserving Outlook/Hotmail forward header lines. */
function htmlToForwardPlain(html: string): string {
  const decoded = decodeHtmlEntities(html)
  return decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Find sender email in De:/From: block (works on raw HTML or plain). */
function extractForwardFromField(source: string): string | undefined {
  const decoded = decodeHtmlEntities(source).replace(/<br\s*\/?>/gi, '\n')
  const line = decoded.match(/(?:^|\n)(?:De|From):\s*(.+)$/im)?.[1]?.trim()
  if (line) {
    const normalized = line.replace(/<(?![^>@]*@[^>]*>)[^>]+>/gi, ' ')
    const email = extractEmailAddress(normalized)
    if (email.includes('@')) return email
  }
  const inline = decoded.match(/(?:De|From):[\s\S]{0,160}?([\w.+-]+@[\w.-]+\.\w+)/i)?.[1]
  return inline
}

/** Pull bare email from "Name <addr@host>" or plain addr@host. */
function extractEmailAddress(fromLine: string): string {
  const angle = fromLine.match(/<([^>]+@[^>]+)>/)
  if (angle) return angle[1].trim()
  const bare = fromLine.match(/[\w.+-]+@[\w.-]+\.\w+/)
  if (bare) return bare[0]
  return fromLine.trim()
}

function headerLine(plain: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(`(?:^|\\n)${name}:\\s*(.+)$`, 'im')
    const m = plain.match(re)?.[1]?.trim()
    if (m) return m
  }
  return undefined
}

export function isForwarded(email: RawEmail): boolean {
  if (FORWARD_SUBJECT.test(email.subject.trim())) return true
  const plain = htmlToForwardPlain(email.body)
  if (FORWARD_BLOCK.test(plain)) return true
  if (OUTLOOK_FORWARD.test(plain)) return true
  // Hotmail/Outlook HTML forwards: De:/From: block inside body
  if (/(?:^|\n)(?:De|From):\s*.+@/im.test(plain) && FORWARD_SUBJECT.test(email.subject)) {
    return true
  }
  return false
}

/** Extract inner bank email from a Gmail forward wrapper. */
export function unwrapForward(email: RawEmail): RawEmail {
  if (!isForwarded(email)) return email

  const plain = htmlToForwardPlain(email.body)

  const from =
    extractForwardFromField(email.body) ??
    extractEmailAddress(headerLine(plain, ['From', 'De']) ?? email.from)

  const subject =
    headerLine(plain, ['Subject', 'Asunto']) ??
    email.subject.replace(FORWARD_SUBJECT, '').trim()

  const dateHeader = headerLine(plain, ['Date', 'Sent', 'Fecha', 'Enviado'])

  const bodyMatch = plain.match(FORWARD_BLOCK)
  let body = plain
  if (bodyMatch?.index !== undefined) {
    body = plain.slice(bodyMatch.index + bodyMatch[0].length).trim()
  } else {
    const outlookBody = plain.match(
      /(?:^|\n)(?:Asunto|Subject):\s*.+\n([\s\S]+)$/im,
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
    attachments: email.attachments,
  }
}
