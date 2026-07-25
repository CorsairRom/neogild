/**
 * Pair single-leg cartola transfers and rebuild account balances.
 * Usage: npx tsx --env-file=.env --env-file=apps/web/.env.local scripts/rebuild-balances.mjs
 */
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const uid = process.env.USER_ID ?? 'd9ca9c84-e07f-4d1b-a8dd-16869adec833'

const { data: paired, error: pairErr } = await admin.rpc('pair_cartola_own_transfers', {
  p_user_id: uid,
})
if (pairErr) throw pairErr
console.log('paired:', paired)

const { data: rebuilt, error: rebuildErr } = await admin.rpc('rebuild_account_balances', {
  p_user_id: uid,
})
if (rebuildErr) throw rebuildErr
console.log('rebuilt:', rebuilt)

const { data: accounts } = await admin
  .from('accounts')
  .select('name, balance')
  .eq('user_id', uid)
  .order('name')

console.table(accounts)
