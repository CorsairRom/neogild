import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { EmailClient, ImapCredentials } from './email-client'
import { normalizeAppPassword } from './email-client'
import type { RawEmail } from './parsers'

function stableMessageId(
  parsedMessageId: string | undefined,
  uid: number,
  fallback: string,
): string {
  if (parsedMessageId) {
    return parsedMessageId.replace(/^<|>$/g, '').trim()
  }
  return `imap:${uid}:${fallback.slice(0, 120)}`
}

async function connectClient(credentials: ImapCredentials): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: credentials.host ?? 'imap.gmail.com',
    port: credentials.port ?? 993,
    secure: true,
    auth: {
      user: credentials.user,
      pass: normalizeAppPassword(credentials.appPassword),
    },
    logger: false,
  })
  await client.connect()
  return client
}

export async function testImapConnection(credentials: ImapCredentials): Promise<void> {
  const client = await connectClient(credentials)
  await client.logout()
}

export async function fetchBankEmailsSince(
  credentials: ImapCredentials,
  since: Date,
): Promise<RawEmail[]> {
  const client = await connectClient(credentials)
  const results: RawEmail[] = []

  const lock = await client.getMailboxLock('INBOX')
  try {
    for await (const msg of client.fetch(
      { since },
      { source: true, envelope: true, uid: true },
    )) {
      const envelopeFrom = msg.envelope?.from?.[0]?.address ?? ''

      const source = msg.source
      if (!source) continue

      const parsed = await simpleParser(source)
      const from =
        parsed.from?.value?.[0]?.address ??
        parsed.from?.text ??
        envelopeFrom

      const date = parsed.date ?? msg.envelope?.date ?? new Date()
      const subject = parsed.subject ?? msg.envelope?.subject ?? ''
      const body =
        (typeof parsed.html === 'string' && parsed.html) ||
        (typeof parsed.textAsHtml === 'string' && parsed.textAsHtml) ||
        parsed.text ||
        ''

      results.push({
        id: stableMessageId(
          parsed.messageId ?? undefined,
          msg.uid,
          `${from}:${subject}:${date.toISOString()}`,
        ),
        from,
        subject,
        date: date.toISOString(),
        body,
      })
    }
  } finally {
    lock.release()
    await client.logout()
  }

  return results
}

export function createImapEmailClient(credentials: ImapCredentials): EmailClient {
  return {
    fetchSince(since: Date) {
      return fetchBankEmailsSince(credentials, since)
    },
  }
}
