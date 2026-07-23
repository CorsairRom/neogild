import type { CategorizationRule } from './inbox'

const CONFIDENCE_AUTO = 0.85

/** Match merchant/description against keyword rules (highest priority first). */
export function matchCategoryByRules(
  text: string,
  rules: CategorizationRule[],
): string | null {
  const upper = text.toUpperCase()
  const sorted = [...rules].sort(
    (a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at),
  )
  for (const rule of sorted) {
    if (upper.includes(rule.pattern.toUpperCase())) return rule.category
  }
  return null
}

/** Extract a stable merchant token for auto-rules from transaction description. */
export function merchantPatternFromDescription(description: string): string | null {
  const trimmed = description.trim()
  if (!trimmed) return null
  const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed
  const token = firstLine.replace(/\s+/g, ' ').slice(0, 48).trim()
  return token.length >= 3 ? token : null
}

export function shouldAutoApplyLlm(confidence: number): boolean {
  return confidence >= CONFIDENCE_AUTO
}

export function shouldNeedsReview(
  confidence: number,
  transactionType: string,
): boolean {
  if (transactionType === 'income') return true
  return confidence < CONFIDENCE_AUTO
}

export { CONFIDENCE_AUTO }
