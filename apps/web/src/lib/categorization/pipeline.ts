import {
  matchCategoryByRules,
  shouldNeedsReview,
  type CategorizationRule,
} from '@neogild/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicDatabase } from '@neogild/core'
import { classifyWithGemini } from './llm'

type AdminClient = SupabaseClient<PublicDatabase, 'public'>

export type CategorizeSummary = {
  scanned: number
  rule_matched: number
  llm_matched: number
  skipped_no_llm: number
  errors: string[]
}

type TransactionRow = PublicDatabase['public']['Tables']['transactions']['Row']
type CategoryRow = PublicDatabase['public']['Tables']['categories']['Row']

export async function runBatchCategorization(
  supabase: AdminClient,
  userId: string,
): Promise<CategorizeSummary> {
  const summary: CategorizeSummary = {
    scanned: 0,
    rule_matched: 0,
    llm_matched: 0,
    skipped_no_llm: 0,
    errors: [],
  }

  const [{ data: transactions, error: txError }, { data: rules, error: rulesError }, { data: categories, error: catError }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .is('category', null)
        .in('type', ['income', 'expense', 'refund'])
        .order('date', { ascending: false })
        .limit(100),
      supabase.from('categorization_rules').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('entity', 'personal'),
    ])

  if (txError) throw txError
  if (rulesError) throw rulesError
  if (catError) throw catError

  const hasLlm = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
  const ruleList = (rules ?? []) as CategorizationRule[]
  const catList = (categories ?? []) as CategoryRow[]

  for (const tx of (transactions ?? []) as TransactionRow[]) {
    summary.scanned++
    const description = tx.description ?? ''

    const ruleCategory = matchCategoryByRules(description, ruleList)
    if (ruleCategory) {
      const { error } = await supabase.rpc('classify_transaction', {
        p_user_id: userId,
        p_transaction_id: tx.id,
        p_category: ruleCategory,
        p_confidence: 1,
        p_needs_review: shouldNeedsReview(1, tx.type),
      })
      if (error) summary.errors.push(`${tx.id}: ${error.message}`)
      else summary.rule_matched++
      continue
    }

    if (!hasLlm) {
      summary.skipped_no_llm++
      continue
    }

    try {
      const result = await classifyWithGemini({
        description,
        amount: tx.amount,
        type: tx.type,
        categories: catList,
      })
      if (!result) {
        summary.skipped_no_llm++
        continue
      }

      const needsReview = shouldNeedsReview(result.confidence, tx.type)
      const { error } = await supabase.rpc('classify_transaction', {
        p_user_id: userId,
        p_transaction_id: tx.id,
        p_category: result.category,
        p_confidence: result.confidence,
        p_needs_review: needsReview,
      })
      if (error) summary.errors.push(`${tx.id}: ${error.message}`)
      else summary.llm_matched++
    } catch (err) {
      summary.errors.push(
        `${tx.id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return summary
}
