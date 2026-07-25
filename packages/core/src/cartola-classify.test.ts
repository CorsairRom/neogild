import { describe, expect, it } from 'vitest'
import {
  classifyCartolaLine,
  inferOwnerNameFromDescriptions,
  personNamesMatch,
} from './cartola-classify'

const OWNER = 'RICHARD ALEXIS ROMERO MOORE'

describe('classifyCartolaLine', () => {
  it('TEF DE tercero → ingreso categorizado', () => {
    const r = classifyCartolaLine('TEF DE YALEY DE FATIMA MERINO CONTR', 100000, 0, OWNER)
    expect(r.type).toBe('income')
    expect(r.category).toBe('ingreso.otro')
    expect(r.needsReview).toBe(false)
  })

  it('TEF DE cuenta propia → transferencia interna', () => {
    const r = classifyCartolaLine('TEF DE RICHARD ALEXIS ROMERO MOORE', 100000, 0, OWNER)
    expect(r.type).toBe('transfer')
    expect(r.kind).toBe('tef_own')
  })

  it('TEF A tercero → egreso transferencia', () => {
    const r = classifyCartolaLine('TEF A MIGUEL ANGEL VALENZUELA VALEN', 0, 16000, OWNER)
    expect(r.type).toBe('expense')
    expect(r.category).toBe('consumo.transferencia')
  })

  it('PAGO COPEC → bencina', () => {
    const r = classifyCartolaLine('PAGO COPEC APP', 0, 9764, OWNER)
    expect(r.type).toBe('expense')
    expect(r.category).toBe('necesidad.bencina')
    expect(r.needsReview).toBe(false)
  })

  it('PAGO desconocido → egreso sin categoría', () => {
    const r = classifyCartolaLine('PAGO TOUR OPERADOR', 0, 18040, OWNER)
    expect(r.type).toBe('expense')
    expect(r.category).toBeNull()
    expect(r.needsReview).toBe(true)
  })
})

describe('personNamesMatch', () => {
  it('matches reordered names', () => {
    expect(personNamesMatch('ROMERO MOORE RICHARD', 'RICHARD ALEXIS ROMERO MOORE')).toBe(true)
  })
})

describe('inferOwnerNameFromDescriptions', () => {
  it('detects repeated TEF name as owner', () => {
    const name = inferOwnerNameFromDescriptions([
      'TEF DE RICHARD ALEXIS ROMERO MOORE',
      'TEF DE RICHARD ALEXIS ROMERO MOORE',
      'TEF A MIGUEL ANGEL VALENZUELA VALEN',
    ])
    expect(name).toBe('RICHARD ALEXIS ROMERO MOORE')
  })
})
