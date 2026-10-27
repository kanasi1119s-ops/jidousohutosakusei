import { describe, expect, it } from 'vitest'
import { isValidRegistrationNumber, normalizeRegistrationNumber, validateInvoice } from './validate'
import { newInvoice } from './storage'
import { emptyIssuer } from './storage'

describe('登録番号', () => {
  it('全角・小文字・ハイフン混じりを正規化する', () => {
    expect(normalizeRegistrationNumber(' ｔ１２３４-５６７８９０１２３ ')).toBe('T1234567890123')
  })
  it('T+13桁のみ有効', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('１２３４５６７８９０１２３')).toBe(false)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('')).toBe(false)
  })
})

describe('validateInvoice', () => {
  const full = () => {
    const inv = newInvoice({ ...emptyIssuer(), name: '山田太郎', registrationNumber: 'T1234567890123' })
    inv.clientName = '株式会社テスト'
    inv.items[0].name = 'デザイン費'
    inv.items[0].unitPrice = 1000
    return inv
  }
  it('必要項目がそろえば適格請求書の要件を満たす', () => {
    const v = validateInvoice(full(), 1100)
    expect(v.errors).toEqual([])
    expect(v.isQualified).toBe(true)
  })
  it('登録番号が未入力なら適格請求書ではない（エラーにはしない）', () => {
    const inv = full()
    inv.issuer.registrationNumber = ''
    const v = validateInvoice(inv, 1100)
    expect(v.isQualified).toBe(false)
    expect(v.errors).toEqual([])
  })
  it('登録番号の形式不正・数量/単価の異常はエラー', () => {
    const inv = full()
    inv.issuer.registrationNumber = 'T123'
    inv.items[0].quantity = 1.2345
    inv.items[0].unitPrice = NaN
    const v = validateInvoice(inv)
    expect(v.errors.length).toBeGreaterThanOrEqual(2)
  })
  it('小数第3位までの数量は許容する', () => {
    const inv = full()
    inv.items[0].quantity = 0.125
    expect(validateInvoice(inv).errors).toEqual([])
  })
})
