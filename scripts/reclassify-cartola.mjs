/**
 * Re-clasifica transacciones importadas de cartola (tipo + categoría).
 * Uso: npx tsx --env-file=.env --env-file=apps/web/.env.local scripts/reclassify-cartola.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { classifyCartolaLine, inferOwnerNameFromDescriptions } from '@neogild/core'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const uid = 'd9ca9c84-e07f-4d1b-a8dd-16869adec833'

const { data: profile } = await admin.from('profiles').select('name').eq('id', uid).single()

const { data: txs } = await admin
  .from('transactions')
  .select('id, description, amount, type, category, metadata')
  .eq('user_id', uid)
  .eq('metadata->>source', 'bancoestado_cartola')

const descriptions = (txs ?? []).map((t) => t.description ?? '')
const ownerName =
  profile?.name ?? inferOwnerNameFromDescriptions(descriptions)

if (!profile?.name && ownerName) {
  await admin.from('profiles').update({ name: ownerName }).eq('id', uid)
  console.log('profile name set:', ownerName)
}

let updated = 0
for (const tx of txs ?? []) {
  const desc = tx.description ?? ''
  const cls = classifyCartolaLine(desc, 0, tx.amount, ownerName)

  const patch = {}
  if (tx.type !== cls.type) patch.type = cls.type
  if (cls.category && tx.category !== cls.category) patch.category = cls.category
  if (cls.category && tx.category === null) patch.needs_review = cls.needsReview

  if (Object.keys(patch).length === 0) continue

  const { error } = await admin.from('transactions').update(patch).eq('id', tx.id)
  if (error) console.error(tx.id, error.message)
  else {
    updated++
    console.log(`${desc.slice(0, 40)} → ${cls.type}${cls.category ? ` / ${cls.category}` : ''}`)
  }
}

console.log(`Updated ${updated} / ${txs?.length ?? 0} cartola transactions`)
