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

    const { runBatchCategorization } = await import('@/lib/categorization/pipeline')
    const categorize = await runBatchCategorization(admin, user.id)

    let cartola_imported = 0
    if ((summary.cartolas_staged ?? 0) > 0) {
      const { data: profile } = await admin
        .from('profiles')
        .select('rut, name')
        .eq('id', user.id)
        .single()

      const { data: pendingCartolas } = await admin
        .from('email_movements')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'bancoestado_cartola')
        .eq('status', 'pending_attachment')
        .not('attachment_path', 'is', null)

      const { parseCartolaPdfBuffer } = await import('@/lib/cartola/pdf')
      const { importCartolaLines } = await import('@/lib/cartola/import')

      const { data: account } = await admin
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', '%cuentarut%')
        .eq('is_archived', false)
        .maybeSingle()

      if (profile?.rut && account) {
        for (const row of pendingCartolas ?? []) {
          const { data: movement } = await admin
            .from('email_movements')
            .select('id, attachment_path, gmail_message_id')
            .eq('id', row.id)
            .single()
          if (!movement?.attachment_path) continue

          const { data: file } = await admin.storage
            .from('email-attachments')
            .download(movement.attachment_path)
          if (!file) continue

          try {
            const parsed = await parseCartolaPdfBuffer(await file.arrayBuffer(), profile.rut)
            const statementMonth =
              parsed.meta.to?.slice(0, 7) ??
              parsed.meta.issuedAt?.slice(0, 7) ??
              '2026-07'

            const result = await importCartolaLines(admin, {
              userId: user.id,
              accountId: account.id,
              gmailMessageId: movement.gmail_message_id,
              lines: parsed.lines,
              statementMonth,
              ownerName: profile.name,
            })
            cartola_imported += result.imported

            await admin
              .from('email_movements')
              .update({
                status: 'promoted',
                error_detail: null,
                raw_snippet: `Cartola importada: ${parsed.lines.length} movimientos (${result.imported} nuevos, ${result.skipped} duplicados)`,
              })
              .eq('id', movement.id)
          } catch (err) {
            console.error('cartola import', movement.id, err)
          }
        }
      }
    }

    return NextResponse.json({ ...summary, categorize, cartola_imported })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
