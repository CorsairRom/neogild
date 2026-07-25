import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailClient } from './email-client'
import { isForwarded, unwrapForward } from './forward'
import {
  buildCartolaRow,
  isCartolaEmail,
  parseEmail,
  sourceForEmail,
  type EmailAttachment,
  type RawEmail,
} from './parsers'

const ATTACHMENTS_BUCKET = 'email-attachments'

async function uploadCartolaPdf(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
  attachments: EmailAttachment[] | undefined,
): Promise<string | null> {
  const pdf = attachments?.find(
    (a) =>
      a.contentType === 'application/pdf' ||
      a.filename.toLowerCase().endsWith('.pdf'),
  )
  if (!pdf?.content?.length) return null

  const safeName = pdf.filename.replace(/[^\w.-]+/g, '_') || 'cartola.pdf'
  const path = `${userId}/${messageId}/${safeName}`

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, pdf.content, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) return null
  return path
}

const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

export interface EmailSyncSummary {
  mode: 'user' | 'cron'
  since: string
  fetched: number
  parsed: number
  ignored: number
  forwards: number
  staged_errors: number
  cartolas_staged: number
  usd_rate: number | null
  promoted: number
  pending: number
  errors: number
  skipped_existing: number
  failures: string[]
}

/** @deprecated Use EmailSyncSummary */
export type GmailSyncSummary = EmailSyncSummary

export interface RunEmailSyncOptions {
  userId: string
  since?: string
  client: EmailClient
  supabase: SupabaseClient
  mode?: 'user' | 'cron'
}

/** @deprecated Use RunEmailSyncOptions */
export type RunGmailSyncOptions = RunEmailSyncOptions

async function fetchUsdRate(): Promise<number | null> {
  try {
    const res = await fetch('https://mindicador.cl/api/dolar')
    if (!res.ok) return null
    const json = (await res.json()) as { serie?: Array<{ valor?: number }> }
    const valor = json.serie?.[0]?.valor
    return typeof valor === 'number' && valor > 0 ? valor : null
  } catch {
    return null
  }
}

export async function runEmailSync(
  options: RunEmailSyncOptions,
): Promise<EmailSyncSummary> {
  const { userId, client, supabase, mode = 'user' } = options

  let since: Date
  if (options.since) {
    since = new Date(options.since)
    if (Number.isNaN(since.getTime())) {
      throw new Error(`invalid since: ${options.since}`)
    }
  } else {
    const { data: state } = await supabase
      .from('sync_state')
      .select('gmail_watermark')
      .eq('user_id', userId)
      .maybeSingle()
    const { count: stagedCount } = await supabase
      .from('email_movements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    // Empty inbox after db reset: ignore watermark and re-fetch historical mail.
    if (stagedCount === 0) {
      since = new Date(Date.now() - DEFAULT_LOOKBACK_MS)
    } else {
      since = state?.gmail_watermark
        ? new Date(state.gmail_watermark)
        : new Date(Date.now() - DEFAULT_LOOKBACK_MS)
    }
  }

  const runStartedAt = new Date()
  let emails: Awaited<ReturnType<EmailClient['fetchSince']>>
  try {
    emails = await client.fetchSince(since)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`IMAP fetch failed: ${message}`)
  }

  const messageIds = emails.map((e: RawEmail) => e.id)
  const seen = new Set<string>()
  if (messageIds.length > 0) {
    const { data: existing } = await supabase
      .from('email_movements')
      .select('gmail_message_id')
      .eq('user_id', userId)
      .in('gmail_message_id', messageIds)
    for (const row of existing ?? []) seen.add(row.gmail_message_id as string)
  }

  let fetched = 0
  let parsed = 0
  let ignored = 0
  let forwards = 0
  let stagedErrors = 0
  let cartolasStaged = 0
  const failures: string[] = []

  for (const email of emails) {
    if (seen.has(email.id)) continue
    fetched++

    if (isForwarded(email)) forwards++

    const normalized = unwrapForward(email)

    if (isCartolaEmail(normalized)) {
      const attachmentPath = await uploadCartolaPdf(
        supabase,
        userId,
        email.id,
        email.attachments,
      )
      const cartola = buildCartolaRow(email, normalized)
      const { error: insertError } = await supabase.from('email_movements').insert({
        ...cartola,
        user_id: userId,
        status: 'pending_attachment',
        attachment_path: attachmentPath,
        error_detail: attachmentPath
          ? null
          : 'PDF adjunto no encontrado en el correo (¿reenvío sin adjunto?)',
      })
      if (insertError && !insertError.message.includes('duplicate')) {
        failures.push(`cartola ${email.id}: ${insertError.message}`)
      } else if (!insertError) {
        cartolasStaged++
      }
      continue
    }

    const result = parseEmail(email)
    if (result === 'ignore') {
      ignored++
      continue
    }

    let row: Record<string, unknown> & { source: string; status: string }
    if (result === null) {
      const source = sourceForEmail(normalized)
      row = {
        gmail_message_id: email.id,
        source: source ?? 'unknown',
        email_date: normalized.date,
        raw_snippet: normalized.body.slice(0, 500),
        status: 'error',
        error_detail: source === null
          ? `unrecognized subject at known sender: "${email.subject.slice(0, 120)}"`
          : 'parser could not extract fields',
      }
      stagedErrors++
    } else {
      row = { ...result, status: 'pending' }
    }

    const { error: insertError } = await supabase
      .from('email_movements')
      .insert({ ...row, user_id: userId })
    if (insertError && !insertError.message.includes('duplicate')) {
      const { error: stubError } = await supabase.from('email_movements').insert({
        user_id: userId,
        gmail_message_id: email.id,
        source: 'unknown',
        email_date: email.date,
        status: 'error',
        error_detail: `stage failed: ${insertError.message.slice(0, 300)}`,
      })
      if (stubError && !stubError.message.includes('duplicate')) {
        failures.push(`stage ${email.id}: ${insertError.message}`)
      } else {
        stagedErrors++
      }
      continue
    }

    if (result !== null) parsed++
  }

  const usdRate = await fetchUsdRate()
  const { data: promoteResult, error: promoteError } = await supabase.rpc(
    'promote_email_movements',
    { p_user_id: userId, p_usd_rate: usdRate },
  )
  if (promoteError) {
    throw new Error(`promote failed: ${promoteError.message}`)
  }

  // Do not advance watermark on empty fetches — avoids skipping forwards that
  // were filtered out (e.g. before IMAP included non-bank senders).
  if (failures.length === 0 && emails.length > 0) {
    await supabase.from('sync_state').upsert({
      user_id: userId,
      gmail_watermark: runStartedAt.toISOString(),
      updated_at: runStartedAt.toISOString(),
    })
  }

  return {
    mode,
    since: since.toISOString(),
    fetched,
    parsed,
    ignored,
    forwards,
    staged_errors: stagedErrors,
    cartolas_staged: cartolasStaged,
    usd_rate: usdRate,
    promoted: (promoteResult as { promoted?: number })?.promoted ?? 0,
    pending: (promoteResult as { pending?: number })?.pending ?? 0,
    errors: ((promoteResult as { errors?: number })?.errors ?? 0) + stagedErrors,
    skipped_existing: (promoteResult as { skipped_existing?: number })?.skipped_existing ?? 0,
    failures,
  }
}

/** @deprecated Use runEmailSync */
export const runGmailSync = runEmailSync
