import { createServiceClient } from '@/lib/supabase/service'
import {
  createImapEmailClient,
  type ImapCredentials,
  testImapConnection,
} from '@neogild/gmail'

export async function getImapCredentialsForUser(
  userId: string,
): Promise<ImapCredentials | null> {
  const supabase = createServiceClient()
  const { data: creds } = await supabase
    .from('email_credentials')
    .select('imap_user, app_password, imap_host')
    .eq('user_id', userId)
    .maybeSingle()

  if (creds?.imap_user && creds?.app_password) {
    return {
      user: creds.imap_user,
      appPassword: creds.app_password,
      host: creds.imap_host ?? undefined,
    }
  }

  const envUser = process.env.GMAIL_USER
  const envPassword = process.env.GMAIL_APP_PASSWORD
  if (envUser && envPassword) {
    return {
      user: envUser,
      appPassword: envPassword,
      host: process.env.GMAIL_IMAP_HOST ?? undefined,
    }
  }

  return null
}

export async function getEmailConnectionStatus(userId: string) {
  const supabase = createServiceClient()
  const { data: creds } = await supabase
    .from('email_credentials')
    .select('imap_user, connected_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (creds) {
    return {
      connected: true as const,
      email: creds.imap_user,
      connectedAt: creds.connected_at,
      source: 'db' as const,
    }
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      connected: true as const,
      email: process.env.GMAIL_USER,
      connectedAt: null,
      source: 'env' as const,
    }
  }

  return { connected: false as const }
}

export async function saveEmailCredentials(
  userId: string,
  credentials: ImapCredentials,
): Promise<void> {
  await testImapConnection(credentials)

  const supabase = createServiceClient()
  const { error } = await supabase.from('email_credentials').upsert({
    user_id: userId,
    imap_user: credentials.user.trim(),
    app_password: credentials.appPassword,
    imap_host: credentials.host ?? 'imap.gmail.com',
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(error.message)
}

export function createEmailClientForUser(credentials: ImapCredentials) {
  return createImapEmailClient(credentials)
}
