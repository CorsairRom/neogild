import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveEmailCredentials } from '@/lib/email/credentials'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    imapUser?: string
    appPassword?: string
    imapHost?: string
  }

  if (!body.imapUser?.trim() || !body.appPassword?.trim()) {
    return NextResponse.json(
      { error: 'imapUser and appPassword are required' },
      { status: 400 },
    )
  }

  try {
    await saveEmailCredentials(user.id, {
      user: body.imapUser.trim(),
      appPassword: body.appPassword.trim(),
      host: body.imapHost?.trim() || undefined,
    })
    return NextResponse.json({ ok: true, email: body.imapUser.trim() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IMAP connection failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('email_credentials')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
