import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmailConnectionStatus } from '@/lib/email/credentials'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getEmailConnectionStatus(user.id)

  const { data: syncState } = await supabase
    .from('sync_state')
    .select('gmail_watermark, updated_at')
    .maybeSingle()

  const { count: pendingCount } = await supabase
    .from('email_movements')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: errorCount } = await supabase
    .from('email_movements')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'error')

  return NextResponse.json({
    connection,
    sync: syncState,
    pending: pendingCount ?? 0,
    errors: errorCount ?? 0,
  })
}
