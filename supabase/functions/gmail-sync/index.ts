// gmail-sync edge function — deprecated (ADR-012).
// Use POST /api/gmail/sync from the web app or `npm run sync:email` for cron.

Deno.serve(async (req) => {
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    return Response.json({ ok: true, transport: 'imap', note: 'use /api/gmail/sync or sync:email' })
  }

  return Response.json(
    {
      error: 'gmail-sync edge function retired',
      message:
        'Email ingestion uses IMAP (ADR-012). Run `npm run sync:email` for cron or POST /api/gmail/sync from the web app.',
    },
    { status: 410 },
  )
})
