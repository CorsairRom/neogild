import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { buildGoogleAuthUrl } from '@neogild/gmail'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
  }

  try {
    const state = crypto.randomUUID()
    const cookieStore = await cookies()
    cookieStore.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    cookieStore.set('gmail_oauth_user', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    return NextResponse.redirect(buildGoogleAuthUrl(state))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth config missing'
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    )
  }
}
