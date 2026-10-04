import { describe, expect, it } from 'vitest'
import { newInvoice } from './calc'
import { buildBackup, parseBackupText, sanitizeInvoice } from './storage'

describe('sanitizeInvoice', () => {
  it('不正な値を安全な値に補正する', () => {
    const inv = sanitizeInvoice({
      issuerName: 123,
      honorific: 'どの',
      rounding: 'x',
      items: [{ description: 'a', quantity: 1e12, unitPriceYen: 'abc', taxRate: 5 }],
    })
    expect(inv.issuerName).toBe('')
    expect(inv.honorific).toBe('御中')
    expect(inv.rounding).toBe('floor')
    expect(inv.items[0].quantity).toBe(99_999)
    expect(inv.items[0].unitPriceYen).toBe(0)
    expect(inv.items[0].taxRate).toBe(10)
  })
  it('明細が空なら1行補う', () => {
    expect(sanitizeInvoice({ items: [] }).items).toHaveLength(1)
  })
  it('オブジェクト以外は拒否', () => {
    expect(() => sanitizeInvoice(null)).toThrow()
  })
})

describe('backup', () => {
  it('往復しても内容が保たれる（日本語含む）', () => {
    const draft = { ...newInvoice(), clientName: '株式会社テスト', notes: '備考\n二行目' }
    const text = JSON.stringify(buildBackup(draft, []))
    expect(parseBackupText(text).draft.clientName).toBe('株式会社テスト')
    expect(parseBackupText('﻿' + text).draft.notes).toBe('備考\n二行目')
  })
  it('別アプリのファイルや壊れたJSONは拒否', () => {
    expect(() => parseBackupText('{"app":"other"}')).toThrow('バックアップファイルではありません')
    expect(() => parseBackupText('{oops')).toThrow('JSON')
  })
})
