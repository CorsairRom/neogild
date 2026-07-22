import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildGmailQuery,
  extractBody,
  headerValue,
  type GmailPayload,
} from './gmail'
import {
  parseEmail,
  sourceForEmail,
  type ParsedMovement,
  type RawEmail,
} from './parsers'
import { isForwarded, unwrapForward } from './forward'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

export interface GmailSyncSummary {
  mode: 'user' | 'cron'
  since: string
  fetched: number
  parsed: number
  ignored: number
  forwards: number
  staged_errors: number
  usd_rate: number | null
  promoted: number
  pending: number
  errors: number
  skipped_existing: number
  failures: string[]
}

export interface GmailOAuthConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export async function refreshAccessToken(
  config: GmailOAuthConfig,
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Gmail token refresh returned no access_token')
  return json.access_token
}

async function listMessageIds(
  accessToken: string,
  query: string,
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const url = new URL(`${GMAIL_API}/messages`)
    url.searchParams.set('q', query)
    url.searchParams.set('maxResults', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`)
    const json = (await res.json()) as {
      messages?: Array<{ id: string }>
      nextPageToken?: string
    }
    for (const m of json.messages ?? []) ids.push(m.id)
    pageToken = json.nextPageToken
  } while (pageToken)
  return ids
}

async function fetchEmail(accessToken: string, id: string): Promise<RawEmail> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail get ${id} failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { payload?: GmailPayload; internalDate?: string }
  const payload = json.payload ?? {}
  return {
    id,
    from: headerValue(payload, 'From'),
    subject: headerValue(payload, 'Subject'),
    date: json.internalDate
      ? new Date(Number.parseInt(json.internalDate, 10)).toISOString()
      : new Date().toISOString(),
    body: extractBody(payload),
  }
}

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

export interface RunGmailSyncOptions {
  userId: string
  since?: string
  oauth: GmailOAuthConfig
  supabase: SupabaseClient
  mode?: 'user' | 'cron'
}

export async function runGmailSync(
  options: RunGmailSyncOptions,
): Promise<GmailSyncSummary> {
  const { userId, oauth, supabase, mode = 'user' } = options

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
    since = state?.gmail_watermark
      ? new Date(state.gmail_watermark)
      : new Date(Date.now() - DEFAULT_LOOKBACK_MS)
  }

  const runStartedAt = new Date()
  const accessToken = await refreshAccessToken(oauth)
  const query = buildGmailQuery(since.getTime() / 1000)
  const messageIds = await listMessageIds(accessToken, query)

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
  const failures: string[] = []

  for (const id of messageIds) {
    if (seen.has(id)) continue
    let email: RawEmail
    try {
      email = await fetchEmail(accessToken, id)
      fetched++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const { error: stubError } = await supabase.from('email_movements').insert({
        user_id: userId,
        gmail_message_id: id,
        source: 'unknown',
        email_date: new Date().toISOString(),
        status: 'error',
        error_detail: `fetch failed: ${message.slice(0, 300)}`,
      })
      if (stubError && !stubError.message.includes('duplicate')) {
        failures.push(`fetch ${id}: ${message}`)
      } else {
        stagedErrors++
      }
      continue
    }

    if (isForwarded(email)) forwards++

    const normalized = unwrapForward(email)
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
      parsed++
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
        failures.push(`stage ${id}: ${insertError.message}`)
      } else {
        stagedErrors++
      }
    }
  }

  const usdRate = await fetchUsdRate()
  const { data: promoteResult, error: promoteError } = await supabase.rpc(
    'promote_email_movements',
    { p_user_id: userId, p_usd_rate: usdRate },
  )
  if (promoteError) {
    throw new Error(`promote failed: ${promoteError.message}`)
  }

  if (failures.length === 0) {
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
    usd_rate: usdRate,
    promoted: (promoteResult as { promoted?: number })?.promoted ?? 0,
    pending: (promoteResult as { pending?: number })?.pending ?? 0,
    errors: ((promoteResult as { errors?: number })?.errors ?? 0) + stagedErrors,
    skipped_existing: (promoteResult as { skipped_existing?: number })?.skipped_existing ?? 0,
    failures,
  }
}
