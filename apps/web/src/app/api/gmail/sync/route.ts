import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  createEmailClientForUser,
  getImapCredentialsForUser,
} from '@/lib/email/credentials'
import { runEmailSync } from '@neogild/gmail'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const imap = await getImapCredentialsForUser(user.id)
  if (!imap) {
    return NextResponse.json(
      {
        error:
          'Email not connected. Add IMAP credentials in Settings or set GMAIL_USER + GMAIL_APP_PASSWORD.',
      },
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
    const summary = await runEmailSync({
      userId: user.id,
      since: since ?? undefined,
      client: createEmailClientForUser(imap),
      supabase: admin,
      mode: 'user',
    })
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
