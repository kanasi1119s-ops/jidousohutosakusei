import { describe, expect, it } from 'vitest'
import { calcInvoice, divideRounded, lineAmount } from './calc'
import { isValidRegistrationNumber, normalizeRegistrationNumber, parseNumber, validateInvoice, emptyInvoice } from './model'
import type { LineItem } from './model'

const it10 = (price: number, q = 1): LineItem => ({ name: 'x', quantity: q, unitPrice: price, taxRate: 10 })
const it8 = (price: number, q = 1): LineItem => ({ name: 'y', quantity: q, unitPrice: price, taxRate: 8 })

describe('calcInvoice', () => {
  it('国税庁Q&A例: 税込10%対象6万円→税5,454円 / 8%対象4万円→税2,962円(切捨て)', () => {
    const r = calcInvoice([it10(60000), it8(40000)], 'inclusive', 'floor')
    expect(r.groups[0].tax).toBe(5454)
    expect(r.groups[1].tax).toBe(2962)
    expect(r.total).toBe(100000)
  })
  it('税抜: 税率ごとに1回だけ端数処理する（明細ごとではない）', () => {
    // 33円 x 3行 = 99円。10% => 9.9円。明細ごと切捨てなら 3円x3=9、まとめて切捨てなら 9
    // 15円 x 3行 = 45円 -> 4.5円: 明細ごと四捨五入だと 2+2+2=6、まとめてだと 5
    const r = calcInvoice([it10(15), it10(15), it10(15)], 'exclusive', 'round')
    expect(r.groups[0].tax).toBe(5)
  })
  it('切上げ・四捨五入・切捨て', () => {
    expect(calcInvoice([it10(105)], 'exclusive', 'floor').tax).toBe(10)
    expect(calcInvoice([it10(105)], 'exclusive', 'round').tax).toBe(11)
    expect(calcInvoice([it10(101)], 'exclusive', 'ceil').tax).toBe(11)
  })
  it('数量が小数でも誤差なく計算する', () => {
    expect(lineAmount(it10(1000, 1.5))).toBe(1500)
    expect(lineAmount(it10(333, 0.1))).toBe(33)
  })
  it('0円・空の明細', () => {
    const r = calcInvoice([it10(0)], 'exclusive', 'floor')
    expect(r.total).toBe(0)
    expect(calcInvoice([], 'exclusive', 'floor').groups).toEqual([])
  })
  it('巨大金額でも安全整数の範囲で計算できる', () => {
    const r = calcInvoice([it10(9_999_999_999, 100)], 'exclusive', 'floor')
    expect(Number.isSafeInteger(r.total)).toBe(true)
  })
  it('divideRounded', () => {
    expect(divideRounded(5, 2, 'round')).toBe(3)
    expect(divideRounded(4, 3, 'round')).toBe(1)
  })
})

describe('model', () => {
  it('登録番号の検証と全角・ハイフンの正規化', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(normalizeRegistrationNumber('t-1234 5678901 23')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
  it('全角数字・カンマ付きの数値を解釈する', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(Number.isNaN(parseNumber(''))).toBe(true)
  })
  it('必須項目の検証', () => {
    const errs = validateInvoice(emptyInvoice('2026-11-08'))
    expect(errs.length).toBeGreaterThan(3)
  })
})

import { buildInvoicesCsv, escapeCsvField } from './csv'
import { parseBackup, backupToJsonBlob, suggestNextNumber, sanitizeInvoice } from './storage'

describe('csv/storage', () => {
  it('CSVはBOM付きで始まり、数式インジェクションを無効化する', () => {
    const inv = { ...emptyInvoice('2026-11-08'), invoiceNumber: 'A-1', clientName: '=cmd|x' }
    const csv = buildInvoicesCsv([inv])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=cmd|x")
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""')
  })
  it('バックアップの往復と不正データの拒否', async () => {
    const inv = { ...emptyInvoice('2026-11-08'), invoiceNumber: '日本語-1', clientName: '株式会社テスト' }
    const blob = backupToJsonBlob([inv])
    const text = await new Promise<string>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.readAsText(blob)
    })
    expect(parseBackup(text)[0].clientName).toBe('株式会社テスト')
    expect(() => parseBackup('{"app":"other","invoices":[]}')).toThrow()
    expect(() => parseBackup('not json')).toThrow()
    expect(sanitizeInvoice({ items: [{ quantity: 'x', unitPrice: 1 }] })).toBeNull()
  })
  it('請求書番号の自動採番', () => {
    expect(suggestNextNumber([])).toBe('INV-0001')
    expect(suggestNextNumber([{ ...emptyInvoice('x'), invoiceNumber: 'INV-0009' }])).toBe('INV-0010')
  })
})
