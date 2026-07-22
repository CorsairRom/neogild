import { createServiceClient } from '@/lib/supabase/service'
import type { GmailOAuthConfig } from '@neogild/gmail'

export async function getGmailOAuthForUser(
  userId: string,
): Promise<GmailOAuthConfig | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  const supabase = createServiceClient()
  const { data: creds } = await supabase
    .from('gmail_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const refreshToken =
    creds?.refresh_token ?? process.env.GMAIL_REFRESH_TOKEN ?? null

  if (!refreshToken) return null

  return { clientId, clientSecret, refreshToken }
}

export async function getGmailConnectionStatus(userId: string) {
  const supabase = createServiceClient()
  const { data: creds } = await supabase
    .from('gmail_credentials')
    .select('email_address, connected_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (creds) {
    return {
      connected: true as const,
      email: creds.email_address,
      connectedAt: creds.connected_at,
      source: 'oauth' as const,
    }
  }

  if (process.env.GMAIL_REFRESH_TOKEN) {
    return {
      connected: true as const,
      email: null,
      connectedAt: null,
      source: 'env' as const,
    }
  }

  return { connected: false as const }
}
