import { describe, expect, it } from 'vitest'
import {
  emptyDoc,
  emptyIssuer,
  formatDateJa,
  isValidIsoDate,
  isValidRegistrationNumber,
  nextNumber,
  normalizeRegistrationNumber,
  safeFileToken,
  validateDocument,
} from './invoice'

const issuer = { name: '山田商店', address: '東京都', contact: '', registrationNumber: 'T1234567890123' }

function validDoc() {
  const d = emptyDoc(new Date(2026, 9, 18))
  d.clientName = '株式会社テスト'
  d.items = [{ name: '制作費', quantity: 1, unitPriceYen: 1000, taxRate: 10 }]
  return d
}

describe('登録番号', () => {
  it('全角・ハイフン・小文字を正規化して検証する', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４-５６７８-９０１２３')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('nextNumber', () => {
  it('末尾の連番を桁を保って繰り上げる', () => {
    expect(nextNumber('INV-2026-0009')).toBe('INV-2026-0010')
    expect(nextNumber('INV-0099')).toBe('INV-0100')
    expect(nextNumber('')).toBe('INV-0001')
    expect(nextNumber('請求A')).toBe('請求A-1')
  })
})

describe('日付', () => {
  it('実在しない日付を弾く', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-10-18')).toBe(true)
    expect(isValidIsoDate('')).toBe(false)
  })
  it('日本語表記', () => {
    expect(formatDateJa('2026-10-08')).toBe('2026年10月8日')
    expect(formatDateJa('bad')).toBe('')
  })
})

describe('validateDocument', () => {
  it('正常な書類はエラーなし', () => {
    expect(validateDocument(validDoc(), issuer).errors).toEqual([])
  })
  it('宛名・発行者・明細が空ならエラー', () => {
    const d = emptyDoc()
    const v = validateDocument(d, emptyIssuer())
    expect(v.errors.length).toBeGreaterThanOrEqual(3)
  })
  it('登録番号の形式不正はエラー、未入力の請求書は警告', () => {
    const d = validDoc()
    expect(validateDocument(d, { ...issuer, registrationNumber: 'T12' }).errors.join()).toContain('登録番号')
    const w = validateDocument(d, { ...issuer, registrationNumber: '' })
    expect(w.errors).toEqual([])
    expect(w.warnings.join()).toContain('登録番号')
  })
  it('請求書で取引年月日が未入力なら警告', () => {
    const d = validDoc()
    expect(validateDocument(d, issuer).warnings.join()).toContain('取引年月日')
    d.transactionDate = '2026年10月分'
    expect(validateDocument(d, issuer).warnings.join()).not.toContain('取引年月日')
    d.kind = 'quote'
    d.transactionDate = ''
    expect(validateDocument(d, issuer).warnings.join()).not.toContain('取引年月日')
  })
  it('数量・単価の異常値を検出する', () => {
    const d = validDoc()
    d.items[0].quantity = 0
    expect(validateDocument(d, issuer).errors.join()).toContain('数量')
    d.items[0].quantity = 1.234
    expect(validateDocument(d, issuer).errors.join()).toContain('小数第2位')
    d.items[0].quantity = 1
    d.items[0].unitPriceYen = 1.5
    expect(validateDocument(d, issuer).errors.join()).toContain('単価')
    d.items[0].unitPriceYen = NaN
    expect(validateDocument(d, issuer).errors.join()).toContain('単価')
    d.items[0].unitPriceYen = 100_000_000
    d.items[0].quantity = 100_000
    expect(validateDocument(d, issuer).errors.join()).toContain('大きすぎ')
  })
})

describe('safeFileToken', () => {
  it('英数字・ハイフン・アンダースコア以外を除く', () => {
    expect(safeFileToken('INV-2026/0001 請求', 'x')).toBe('INV-20260001')
    expect(safeFileToken('請求書', 'draft')).toBe('draft')
  })
})
