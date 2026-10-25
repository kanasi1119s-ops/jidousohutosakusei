import { describe, expect, it } from 'vitest'
import {
  calcTotals,
  divideRounded,
  emptyInvoice,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumberInput,
  validateInvoice,
  type InvoiceItem,
} from './calc'

const item = (unit: number, rate: 10 | 8 | 0, qty = 1): InvoiceItem => ({
  description: 'x',
  quantity: qty,
  unitPriceYen: unit,
  taxRate: rate,
})

describe('divideRounded', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(divideRounded(105, 100, 'floor')).toBe(1)
    expect(divideRounded(150, 100, 'round')).toBe(2)
    expect(divideRounded(149, 100, 'round')).toBe(1)
    expect(divideRounded(101, 100, 'ceil')).toBe(2)
  })
})

describe('calcTotals', () => {
  it('税抜表示: 税率ごとに1回だけ端数処理する', () => {
    // 10%対象: 333+333+333=999 → 99.9 → 切り捨て99（行ごとに処理すると 33*3=99 だが別の値になるケースの確認）
    const t = calcTotals({
      items: [item(333, 10), item(333, 10), item(333, 10), item(1000, 8)],
      priceMode: 'exclusive',
      rounding: 'floor',
    })
    expect(t.byRate).toHaveLength(2)
    expect(t.byRate[0]).toMatchObject({ taxRate: 10, taxableYen: 999, taxYen: 99, grossYen: 1098 })
    expect(t.byRate[1]).toMatchObject({ taxRate: 8, taxableYen: 1000, taxYen: 80, grossYen: 1080 })
    expect(t.totalYen).toBe(2178)
  })

  it('税込表示: 消費税額を内税から逆算する', () => {
    const t = calcTotals({ items: [item(1100, 10), item(108, 8)], priceMode: 'inclusive', rounding: 'floor' })
    expect(t.byRate[0]).toMatchObject({ taxableYen: 1000, taxYen: 100, grossYen: 1100 })
    expect(t.byRate[1]).toMatchObject({ taxableYen: 100, taxYen: 8, grossYen: 108 })
    expect(t.totalYen).toBe(1208)
  })

  it('端数処理の違いが反映される', () => {
    const items = [item(105, 10)]
    expect(calcTotals({ items, priceMode: 'exclusive', rounding: 'floor' }).taxYen).toBe(10)
    expect(calcTotals({ items, priceMode: 'exclusive', rounding: 'round' }).taxYen).toBe(11)
    expect(calcTotals({ items, priceMode: 'exclusive', rounding: 'ceil' }).taxYen).toBe(11)
  })

  it('小数の数量と値引き行（マイナス）を扱える', () => {
    const t = calcTotals({
      items: [item(1000, 10, 1.5), item(-500, 10)],
      priceMode: 'exclusive',
      rounding: 'floor',
    })
    expect(t.lineAmountsYen).toEqual([1500, -500])
    expect(t.byRate[0]).toMatchObject({ taxableYen: 1000, taxYen: 100 })
  })

  it('非課税(0%)は税額0', () => {
    const t = calcTotals({ items: [item(5000, 0)], priceMode: 'exclusive', rounding: 'floor' })
    expect(t.taxYen).toBe(0)
    expect(t.totalYen).toBe(5000)
  })

  it('0.1×3 のような浮動小数点誤差が出ない', () => {
    const t = calcTotals({ items: [item(1000, 10, 0.3)], priceMode: 'exclusive', rounding: 'floor' })
    expect(t.lineAmountsYen[0]).toBe(300)
  })
})

describe('登録番号', () => {
  it('全角・ハイフン・小文字を正規化する', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４-５６７８９０１２３')).toBe('T1234567890123')
  })
  it('形式検証', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('parseNumberInput', () => {
  it('全角数字・カンマを受け付け、不正値はNaN', () => {
    expect(parseNumberInput('１，２００')).toBe(1200)
    expect(parseNumberInput('-500')).toBe(-500)
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('')).toBeNaN()
  })
})

describe('validateInvoice', () => {
  it('空の請求書はエラーになり、正しい入力ならエラーなし', () => {
    const inv = emptyInvoice('2026-10-25', 'a')
    expect(validateInvoice(inv).length).toBeGreaterThan(0)
    inv.seller.name = '山田デザイン'
    inv.seller.registrationNumber = 'T1234567890123'
    inv.clientName = '株式会社サンプル'
    inv.items = [{ description: 'ロゴ制作', quantity: 1, unitPriceYen: 50000, taxRate: 10 }]
    expect(validateInvoice(inv)).toEqual([])
  })
  it('登録番号の形式不正を検出する', () => {
    const inv = emptyInvoice('2026-10-25', 'a')
    inv.seller.name = 'a'
    inv.clientName = 'b'
    inv.seller.registrationNumber = 'T12'
    inv.items = [{ description: 'x', quantity: 1, unitPriceYen: 1, taxRate: 10 }]
    expect(validateInvoice(inv).join()).toContain('登録番号')
  })
})

import { buildInvoiceCsv, safeFileName } from './csv'
import { parseImportedJson, exportJson, sanitizeData } from './storage'

describe('csv', () => {
  it('BOM付きで先頭が式の文字列は無効化される', () => {
    const inv = emptyInvoice('2026-10-25', 'a')
    inv.items = [{ description: '=HYPERLINK("x")', quantity: 1, unitPriceYen: 100, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('請求書番号')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('請求書 INV/2026', 'csv')).toBe('INV-2026.csv')
    expect(safeFileName('日本語のみ', 'csv')).toBe('invoice.csv')
  })
})

describe('storage', () => {
  it('エクスポート→インポートで往復できる', () => {
    const inv = emptyInvoice('2026-10-25', 'abc')
    inv.clientName = '株式会社サンプル'
    inv.items = [{ description: 'ロゴ制作', quantity: 2, unitPriceYen: 1000, taxRate: 8 }]
    const back = parseImportedJson(exportJson({ invoices: [inv] }))
    expect(back.invoices[0]).toEqual(inv)
  })
  it('他アプリのJSONは拒否し、壊れた値は整える', () => {
    expect(() => parseImportedJson('{"foo":1}')).toThrow()
    const d = sanitizeData({ invoices: [{ id: 'x', items: [{ taxRate: 99, quantity: 'a' }], priceMode: 'zzz' }, 5] })
    expect(d.invoices).toHaveLength(1)
    expect(d.invoices[0].items[0].taxRate).toBe(10)
    expect(d.invoices[0].priceMode).toBe('exclusive')
  })
})
