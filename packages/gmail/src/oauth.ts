const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

export function getGmailOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    process.env.GMAIL_REDIRECT_URI ??
    'http://localhost:3000/api/gmail/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  }

  return { clientId, clientSecret, redirectUri }
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGmailOAuthConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGmailOAuthConfig()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${await res.text()}`)
  }
  return res.json() as Promise<{
    refresh_token?: string
    access_token?: string
    expires_in?: number
  }>
}

export async function fetchGmailProfile(accessToken: string): Promise<string | null> {
  const res = await fetch(`${'https://gmail.googleapis.com/gmail/v1/users/me'}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { emailAddress?: string }
  return json.emailAddress ?? null
}
