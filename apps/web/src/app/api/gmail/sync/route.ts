import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runGmailSync } from '@neogild/gmail'
import { getGmailOAuthForUser } from '@/lib/gmail/credentials'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauth = await getGmailOAuthForUser(user.id)
  if (!oauth) {
    return NextResponse.json(
      { error: 'Gmail not connected. Configure OAuth in Settings or set GMAIL_REFRESH_TOKEN.' },
      { status: 400 },
    )
  }

  const url = new URL(request.url)
  let since = url.searchParams.get('since')
  if (!since) {
    try {
      const body = (await request.json()) as { since?: string }
      since = body.since ?? null
    } catch {
      // empty body ok
    }
  }

  try {
    const admin = createServiceClient()
    const summary = await runGmailSync({
      userId: user.id,
      since: since ?? undefined,
      oauth,
      supabase: admin,
      mode: 'user',
    })
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
