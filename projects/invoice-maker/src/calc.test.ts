import { describe, expect, it } from 'vitest'
import { calcInvoice, divideRound, validateInvoice, withholdingTax } from './calc'
import { emptyInvoice, isValidDate, isValidRegistrationNumber, nextNumber, normalizeRegistrationNumber, parseBackupText, parseNumber, sanitizeInvoice } from './model'
import { buildInvoicesCsv, escapeCsvField, neutralizeFormula, safeFileStem } from './csv'
import { renderInvoiceHtml } from './preview'
import { mergeInvoices } from './storage'

const base = { priceMode: 'exclusive' as const, rounding: 'floor' as const, withholding: false }

describe('消費税計算（税率ごとに1回だけ端数処理）', () => {
  it('国税庁Q&A問57: 税込 10%対象60,000円・8%対象40,000円', () => {
    const t = calcInvoice({
      ...base,
      priceMode: 'inclusive',
      lines: [
        { description: 'a', quantity: 1, unitPrice: 60000, taxRate: 10 },
        { description: 'b', quantity: 1, unitPrice: 40000, taxRate: 8 },
      ],
    })
    expect(t.groups.find((g) => g.rate === 10)?.tax).toBe(5454)
    expect(t.groups.find((g) => g.rate === 8)?.tax).toBe(2962)
    expect(t.total).toBe(100000)
  })

  it('明細ごとではなく合計に対して1回だけ端数処理する', () => {
    // 税抜 15円×10行: 明細ごとに切り捨てると 1円×10=10円、合計で切り捨てると 15円
    const lines = Array.from({ length: 10 }, () => ({ description: 'x', quantity: 1, unitPrice: 15, taxRate: 10 as const }))
    const t = calcInvoice({ ...base, lines })
    expect(t.groups[0].subtotal).toBe(150)
    expect(t.groups[0].tax).toBe(15)
  })

  it('端数処理方式: 切り捨て/四捨五入/切り上げ', () => {
    const lines = [{ description: 'x', quantity: 1, unitPrice: 105, taxRate: 10 as const }] // 10.5
    expect(calcInvoice({ ...base, lines, rounding: 'floor' }).tax).toBe(10)
    expect(calcInvoice({ ...base, lines, rounding: 'round' }).tax).toBe(11)
    expect(calcInvoice({ ...base, lines, rounding: 'ceil' }).tax).toBe(11)
  })

  it('税込入力: 税抜 = 税込 − 税額', () => {
    const t = calcInvoice({ ...base, priceMode: 'inclusive', lines: [{ description: 'x', quantity: 1, unitPrice: 1100, taxRate: 10 }] })
    expect(t.subtotal).toBe(1000)
    expect(t.tax).toBe(100)
    expect(t.total).toBe(1100)
  })

  it('非課税は税額0、小数の数量でも浮動小数点誤差が出ない', () => {
    const t = calcInvoice({
      ...base,
      lines: [
        { description: 'x', quantity: 0.1, unitPrice: 30000, taxRate: 0 },
        { description: 'y', quantity: 1.5, unitPrice: 1000, taxRate: 10 },
      ],
    })
    expect(t.groups.find((g) => g.rate === 0)?.subtotal).toBe(3000)
    expect(t.groups.find((g) => g.rate === 0)?.tax).toBe(0)
    expect(t.groups.find((g) => g.rate === 10)?.subtotal).toBe(1500)
  })

  it('マイナス明細（値引き）を扱える', () => {
    const t = calcInvoice({
      ...base,
      lines: [
        { description: 'x', quantity: 1, unitPrice: 10000, taxRate: 10 },
        { description: '値引き', quantity: 1, unitPrice: -1000, taxRate: 10 },
      ],
    })
    expect(t.subtotal).toBe(9000)
    expect(t.tax).toBe(900)
  })

  it('divideRound の境界', () => {
    expect(divideRound(0, 100, 'ceil')).toBe(0)
    expect(divideRound(5, 10, 'round')).toBe(1)
    expect(divideRound(4, 10, 'round')).toBe(0)
    expect(divideRound(-15, 10, 'round')).toBe(-2)
  })
})

describe('源泉徴収税額', () => {
  it('100万円以下は10.21%、1円未満切り捨て', () => {
    expect(withholdingTax(500000)).toBe(51050)
    expect(withholdingTax(1000)).toBe(102)
  })
  it('100万円超の部分は20.42%（150万円で204,200円）', () => {
    expect(withholdingTax(1000000)).toBe(102100)
    expect(withholdingTax(1500000)).toBe(204200)
  })
  it('請求額は税込合計から源泉徴収税額を引く', () => {
    const t = calcInvoice({ ...base, withholding: true, lines: [{ description: 'x', quantity: 1, unitPrice: 500000, taxRate: 10 }] })
    expect(t.total).toBe(550000)
    expect(t.withholding).toBe(51050)
    expect(t.payable).toBe(498950)
  })
})

describe('入力の検証・正規化', () => {
  it('全角数字を半角にして数値化する', () => {
    expect(parseNumber('１，２３４.５')).toBe(1234.5)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
  it('登録番号の正規化と検証', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４－５６７８９０１２３')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T12345')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
  it('日付の検証', () => {
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026/02/28')).toBe(false)
  })
  it('請求書番号の連番', () => {
    expect(nextNumber('INV-202610-001')).toBe('INV-202610-002')
    expect(nextNumber('A-9')).toBe('A-10')
    expect(nextNumber('ABC')).toBe('ABC-2')
  })
  it('必須項目・不正値のエラー', () => {
    const inv = emptyInvoice()
    expect(validateInvoice(inv, '').length).toBeGreaterThan(0) // 請求先なし
    inv.clientName = '株式会社テスト'
    expect(validateInvoice(inv, '')).toEqual([])
    expect(validateInvoice(inv, 'T123')[0]).toContain('登録番号')
    inv.lines[0].quantity = NaN
    expect(validateInvoice(inv, '').some((e) => e.includes('数値'))).toBe(true)
    inv.lines[0].quantity = -1
    expect(validateInvoice(inv, '').some((e) => e.includes('0以上'))).toBe(true)
  })
})

describe('インポートの安全性', () => {
  it('不正なJSON・形式を拒否する', () => {
    expect(() => parseBackupText('not json')).toThrow()
    expect(() => parseBackupText('{"version":2,"invoices":[]}')).toThrow()
  })
  it('BOM付きJSONを読める', () => {
    const t = parseBackupText('﻿' + JSON.stringify({ version: 1, issuer: { name: '山田' }, invoices: [] }))
    expect(t.issuer.name).toBe('山田')
  })
  it('不正な型は安全な値へ整形される', () => {
    const inv = sanitizeInvoice({ number: 5, lines: [{ quantity: 'x', unitPrice: Infinity, taxRate: 99 }], priceMode: 'zzz', issueDate: 'bad' })
    expect(inv.number).toBe('')
    expect(inv.lines[0]).toMatchObject({ quantity: 0, unitPrice: 0, taxRate: 10 })
    expect(inv.priceMode).toBe('exclusive')
    expect(isValidDate(inv.issueDate)).toBe(true)
  })
  it('id が同じ請求書は上書きマージされる', () => {
    const a = emptyInvoice(); a.number = 'A'
    const b = { ...a, number: 'B' }
    expect(mergeInvoices([a], [b])).toHaveLength(1)
    expect(mergeInvoices([a], [b])[0].number).toBe('B')
  })
})

describe('CSV・プレビュー', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含む', () => {
    const inv = emptyInvoice(); inv.clientName = '株式会社テスト'
    const csv = buildInvoicesCsv([inv])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain('株式会社テスト')
  })
  it('CSVインジェクションを無害化し、カンマ・引用符をエスケープする', () => {
    expect(neutralizeFormula('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")")
    expect(neutralizeFormula('通常')).toBe('通常')
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""')
  })
  it('ファイル名用の文字列は英数字のみになる', () => {
    expect(safeFileStem('請求書/2026 10')).toBe('2026-10')
    expect(safeFileStem('日本語')).toBe('invoice')
  })
  it('プレビューはHTMLをエスケープする（XSS対策）', () => {
    const inv = emptyInvoice()
    inv.clientName = '<img src=x onerror=alert(1)>'
    inv.lines[0].description = '<script>alert(1)</script>'
    const html = renderInvoiceHtml(inv, { name: '"><b>', registrationNumber: '', address: '', tel: '', email: '', bank: '' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;img')
  })
  it('適格請求書の記載事項（登録番号・税率ごとの税額）がプレビューに含まれる', () => {
    const inv = emptyInvoice(); inv.clientName = 'X'
    inv.lines = [
      { description: '商品A', quantity: 1, unitPrice: 1000, taxRate: 10 },
      { description: '食品B', quantity: 1, unitPrice: 1000, taxRate: 8 },
    ]
    const html = renderInvoiceHtml(inv, { name: '山田', registrationNumber: 'T1234567890123', address: '', tel: '', email: '', bank: '' })
    expect(html).toContain('T1234567890123')
    expect(html).toContain('10%対象')
    expect(html).toContain('8%対象（軽減税率）')
    expect(html).toContain('食品B※')
  })
})
