import { beforeEach, describe, expect, it } from 'vitest'
import { computeEntry, validateEntry, parseAmount } from './calc'
import { loadEntries, saveEntries } from './storage'
import { MAX_AMOUNT_YEN } from './rules'

const d = { label: '', category: 'author', taxRatePercent: 10, taxSeparated: true } as const

describe('境界値', () => {
  it('上限ちょうどは許可、超過は拒否', () => {
    expect(validateEntry({ ...d, amountYen: MAX_AMOUNT_YEN })).toHaveLength(0)
    expect(validateEntry({ ...d, amountYen: MAX_AMOUNT_YEN + 1 })).not.toHaveLength(0)
  })
  it('上限額でも整数のまま計算できる', () => {
    const r = computeEntry({ id: 1, ...d, amountYen: MAX_AMOUNT_YEN })
    expect(Number.isSafeInteger(r.withholdingYen)).toBe(true)
    expect(r.withholdingYen).toBe(Math.floor(((MAX_AMOUNT_YEN - 1_000_000) * 2042) / 10000) + 102100)
  })
  it('巨大な桁数の入力は null', () => {
    expect(parseAmount('9'.repeat(40))).toBeNull()
  })
})

describe('保存データの破損耐性', () => {
  beforeEach(() => localStorage.clear())
  it('壊れたJSONは空配列', () => {
    localStorage.setItem('withholding-tax-calculator:entries:v1', '{broken')
    expect(loadEntries()).toEqual([])
  })
  it('不正な要素は除外し、正常な要素は保持', () => {
    const ok = { id: 1, label: 'a', category: 'author', amountYen: 5, taxRatePercent: 10, taxSeparated: true }
    localStorage.setItem('withholding-tax-calculator:entries:v1', JSON.stringify([ok, { id: 2 }, null]))
    expect(loadEntries()).toEqual([ok])
  })
  it('保存→復元', () => {
    const ok = { id: 1, label: '日本語', category: 'professional', amountYen: 5, taxRatePercent: 8, taxSeparated: false } as const
    saveEntries([ok])
    expect(loadEntries()).toEqual([ok])
  })
})
