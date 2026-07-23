import { KNOWN_SENDERS } from './senders'

export { KNOWN_SENDERS, isKnownSender } from './senders'

export function buildGmailQuery(afterEpochSeconds: number): string {
  const from = KNOWN_SENDERS.map((s: (typeof KNOWN_SENDERS)[number]) => `from:${s}`).join(' OR ')
  return `(${from}) after:${Math.floor(afterEpochSeconds)}`
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64').toString('utf-8')
}

export interface GmailPayload {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
  headers?: Array<{ name: string; value: string }>
}

export function headerValue(payload: GmailPayload, name: string): string {
  const target = name.toLowerCase()
  return payload.headers?.find((h) => h.name.toLowerCase() === target)?.value ?? ''
}

function collectParts(payload: GmailPayload, mime: string): string[] {
  const out: string[] = []
  if (payload.mimeType === mime && payload.body?.data) {
    out.push(decodeBase64Url(payload.body.data))
  }
  for (const part of payload.parts ?? []) {
    out.push(...collectParts(part, mime))
  }
  return out
}

/** Prefer text/html, fall back to text/plain, then the top-level body. */
export function extractBody(payload: GmailPayload): string {
  const html = collectParts(payload, 'text/html')
  if (html.length > 0) return html.join('\n')
  const plain = collectParts(payload, 'text/plain')
  if (plain.length > 0) return plain.join('\n')
  return payload.body?.data ? decodeBase64Url(payload.body.data) : ''
}
