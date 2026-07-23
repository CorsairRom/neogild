import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createCategorizationRule,
  merchantPatternFromDescription,
  setTransactionCategory,
} from '@neogild/core'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    category: string
    remember?: boolean
  }
  if (!body.category?.trim()) {
    return NextResponse.json({ error: 'category required' }, { status: 400 })
  }

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .select('description')
    .eq('id', id)
    .maybeSingle()
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const updated = await setTransactionCategory(supabase, id, body.category.trim())

    if (body.remember !== false) {
      const pattern = merchantPatternFromDescription(tx.description ?? '')
      if (pattern) {
        await createCategorizationRule(supabase, {
          pattern: pattern.toUpperCase().slice(0, 40),
          category: body.category.trim(),
          priority: 15,
        }).catch(() => {
          // duplicate pattern — ignore
        })
      }
    }

    return NextResponse.json({ transaction: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
