import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { exchangeCodeForTokens, fetchGmailProfile } from '@neogild/gmail'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  if (oauthError) {
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(oauthError)}`, base))
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gmail_oauth_state')?.value
  const userId = cookieStore.get('gmail_oauth_user')?.value

  cookieStore.delete('gmail_oauth_state')
  cookieStore.delete('gmail_oauth_user')

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    return NextResponse.redirect(new URL('/settings?error=invalid_oauth_state', base))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings?error=no_refresh_token', base))
    }

    const email = tokens.access_token
      ? await fetchGmailProfile(tokens.access_token)
      : null

    const supabase = createServiceClient()
    const { error } = await supabase.from('gmail_credentials').upsert({
      user_id: userId,
      refresh_token: tokens.refresh_token,
      email_address: email,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error.message)}`, base),
      )
    }

    await supabase.rpc('seed_default_categorization_rules', { p_user_id: userId })

    return NextResponse.redirect(new URL('/settings?connected=1', base))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed'
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, base))
  }
}
