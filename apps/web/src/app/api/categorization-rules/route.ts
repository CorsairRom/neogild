import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createCategorizationRule,
  deleteCategorizationRule,
  getCategorizationRules,
} from '@neogild/core'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rules = await getCategorizationRules(supabase)
    return NextResponse.json({ rules })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    pattern?: string
    category?: string
    priority?: number
  }
  if (!body.pattern?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: 'pattern and category required' }, { status: 400 })
  }

  try {
    const rule = await createCategorizationRule(supabase, {
      pattern: body.pattern.trim().toUpperCase(),
      category: body.category.trim(),
      priority: body.priority ?? 10,
    })
    return NextResponse.json({ rule })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await deleteCategorizationRule(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
