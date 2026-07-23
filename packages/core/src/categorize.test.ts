import { describe, expect, it } from 'vitest'
import {
  matchCategoryByRules,
  merchantPatternFromDescription,
  shouldAutoApplyLlm,
  shouldNeedsReview,
} from './categorize'
import type { CategorizationRule } from './inbox'

const rules: CategorizationRule[] = [
  {
    id: '1',
    user_id: 'u1',
    pattern: 'JUMBO',
    category: 'necesidad.super',
    priority: 10,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    user_id: 'u1',
    pattern: 'SPOTIFY',
    category: 'consumo.entretencion',
    priority: 10,
    created_at: '2026-01-02T00:00:00Z',
  },
]

describe('categorize', () => {
  it('matches rules by substring', () => {
    expect(matchCategoryByRules('JUMBO MALL CENTRO', rules)).toBe('necesidad.super')
    expect(matchCategoryByRules('Spotify P449', rules)).toBe('consumo.entretencion')
    expect(matchCategoryByRules('UNKNOWN SHOP', rules)).toBeNull()
  })

  it('extracts merchant pattern for auto-rules', () => {
    expect(merchantPatternFromDescription('Farmacia Ahumada Centro')).toBe(
      'Farmacia Ahumada Centro',
    )
  })

  it('applies confidence thresholds', () => {
    expect(shouldAutoApplyLlm(0.9)).toBe(true)
    expect(shouldAutoApplyLlm(0.5)).toBe(false)
    expect(shouldNeedsReview(0.9, 'expense')).toBe(false)
    expect(shouldNeedsReview(0.9, 'income')).toBe(true)
  })
})
