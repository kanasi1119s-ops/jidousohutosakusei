import { describe, expect, it } from 'vitest'
import { advanceNumbering, formatInvoiceNumber, validatePrefix, type NumberingState } from './numbering'

describe('formatInvoiceNumber', () => {
  it('接頭辞-4桁ゼロ埋め連番の形式で返す', () => {
    const state: NumberingState = { prefix: 'INV-2026', nextNumber: 7 }
    expect(formatInvoiceNumber(state)).toBe('INV-2026-0007')
  })
  it('4桁を超える連番でもそのまま出力する', () => {
    expect(formatInvoiceNumber({ prefix: 'X', nextNumber: 12345 })).toBe('X-12345')
  })
  it('接頭辞が空なら既定値INVを使う', () => {
    expect(formatInvoiceNumber({ prefix: '', nextNumber: 1 })).toBe('INV-0001')
  })
})

describe('advanceNumbering', () => {
  it('nextNumberを1つ進めた新しい状態を返す（元の状態は変更しない）', () => {
    const state: NumberingState = { prefix: 'INV', nextNumber: 1 }
    const next = advanceNumbering(state)
    expect(next.nextNumber).toBe(2)
    expect(state.nextNumber).toBe(1)
  })
})

describe('validatePrefix', () => {
  it('空はエラー', () => {
    expect(validatePrefix('').length).toBeGreaterThan(0)
  })
  it('全角文字を含むとエラー', () => {
    expect(validatePrefix('請求書').length).toBeGreaterThan(0)
  })
  it('半角英数字とハイフンはOK', () => {
    expect(validatePrefix('INV-2026')).toHaveLength(0)
  })
})
