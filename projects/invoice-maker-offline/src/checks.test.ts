import { describe, expect, it } from 'vitest'
import { computeInvoice } from './calc'
import { checkQualifiedInvoice, isValidIsoDate } from './checks'
import { emptyDoc, emptyIssuer } from './types'

describe('適格請求書チェック', () => {
  it('必要項目が揃っていればすべてOK', () => {
    const doc = emptyDoc()
    doc.clientName = '株式会社テスト'
    doc.items = [{ description: '制作費', quantity: '1', unitPrice: '1000', taxRate: 10 }]
    const issuer = { ...emptyIssuer(), name: '山田太郎', registrationNumber: 'T7000012050002' }
    const items = checkQualifiedInvoice(doc, issuer, computeInvoice(doc.items, doc.rounding, false))
    expect(items.every((i) => i.ok)).toBe(true)
  })
  it('未入力の項目はNGになる', () => {
    const doc = emptyDoc()
    const items = checkQualifiedInvoice(doc, emptyIssuer(), computeInvoice(doc.items, doc.rounding, false))
    const ng = items.filter((i) => !i.ok).map((i) => i.id)
    expect(ng).toEqual(expect.arrayContaining(['issuer-name', 'registration', 'description', 'client-name']))
  })
  it('日付の妥当性', () => {
    expect(isValidIsoDate('2026-10-22')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})
