import { describe, expect, it } from 'vitest'
import { defaultState, parseState } from './state'

describe('parseState', () => {
  it('正常なデータを読み込む', () => {
    const s = parseState({ clientName: '株式会社テスト', items: [{ name: 'a', quantity: 1, unitPriceYen: 100, taxRate: 8 }] })
    expect(s?.clientName).toBe('株式会社テスト')
    expect(s?.items[0].taxRate).toBe(8)
  })
  it('不正な型・税率は拒否する', () => {
    expect(parseState(null)).toBeNull()
    expect(parseState({ clientName: 1 })).toBeNull()
    expect(parseState({ items: [{ name: 'a', quantity: 1, unitPriceYen: 1, taxRate: 5 }] })).toBeNull()
    expect(parseState({ rounding: 'bad' })).toBeNull()
    expect(parseState({ items: [{ name: 'a', quantity: Infinity, unitPriceYen: 1, taxRate: 10 }] })).toBeNull()
  })
  it('既定値が補完される', () => {
    expect(parseState({})?.rounding).toBe(defaultState().rounding)
  })
})
