import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runBatchCategorization } from '@/lib/categorization/pipeline'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createServiceClient()
    const summary = await runBatchCategorization(admin, user.id)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'categorize failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
