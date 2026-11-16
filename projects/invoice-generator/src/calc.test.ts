import { describe, expect, it } from 'vitest'
import { calcWithholding, computeInvoice, lineAmount, roundDiv, validateInvoice, type Invoice, type Item } from './calc'

const item = (quantity: number, unitPriceYen: number, taxRate: 10 | 8 | 0 = 10): Item => ({
  name: 'x',
  quantity,
  unitPriceYen,
  taxRate,
})

describe('roundDiv', () => {
  it('切り捨て・切り上げ・四捨五入', () => {
    expect(roundDiv(15, 10, 'floor')).toBe(1)
    expect(roundDiv(11, 10, 'ceil')).toBe(2)
    expect(roundDiv(15, 10, 'round')).toBe(2)
    expect(roundDiv(14, 10, 'round')).toBe(1)
  })
  it('負数は絶対値で処理し -0 にならない', () => {
    expect(roundDiv(-15, 10, 'round')).toBe(-2)
    expect(roundDiv(-5, 10, 'floor')).toBe(0)
    expect(Object.is(roundDiv(-5, 10, 'floor'), -0)).toBe(false)
  })
})

describe('computeInvoice', () => {
  it('税率ごとに1回だけ端数処理する（品目ごとの処理と結果が異なるケース）', () => {
    const t = computeInvoice({ items: [item(1, 7), item(1, 7), item(1, 7)], priceMode: 'exclusive', rounding: 'round', withholding: false })
    // 合計21円 x 10% = 2.1 → 2円。品目ごと四捨五入なら 0.7→1円 x3 = 3円となり不一致
    expect(t.taxYen).toBe(2)
    expect(t.grossYen).toBe(23)
  })
  it('10%と8%を区分して集計する', () => {
    const t = computeInvoice({ items: [item(1, 1000, 10), item(2, 500, 8)], priceMode: 'exclusive', rounding: 'floor', withholding: false })
    expect(t.groups.map((g) => [g.rate, g.netYen, g.taxYen])).toEqual([
      [10, 1000, 100],
      [8, 1000, 80],
    ])
    expect(t.grossYen).toBe(2180)
  })
  it('税込入力では内税を逆算する', () => {
    const t = computeInvoice({ items: [item(1, 1100, 10)], priceMode: 'inclusive', rounding: 'floor', withholding: false })
    expect(t.groups[0]).toMatchObject({ netYen: 1000, taxYen: 100, grossYen: 1100 })
    const t8 = computeInvoice({ items: [item(1, 1000, 8)], priceMode: 'inclusive', rounding: 'floor', withholding: false })
    expect(t8.groups[0].taxYen).toBe(74) // 1000*8/108=74.07
  })
  it('小数数量でも浮動小数誤差が出ない', () => {
    expect(lineAmount(item(0.1 + 0.2, 1000), 'floor')).toBe(300)
    expect(lineAmount(item(1.005, 1000), 'floor')).toBe(1005)
  })
  it('値引き行（負の単価）を扱える', () => {
    const t = computeInvoice({ items: [item(1, 10000), item(1, -1000)], priceMode: 'exclusive', rounding: 'floor', withholding: false })
    expect(t.netYen).toBe(9000)
    expect(t.taxYen).toBe(900)
  })
  it('源泉徴収は税抜額に対して計算し請求額から差し引く', () => {
    const t = computeInvoice({ items: [item(1, 100000)], priceMode: 'exclusive', rounding: 'floor', withholding: true })
    expect(t.withholdingYen).toBe(10210)
    expect(t.payableYen).toBe(110000 - 10210)
  })
})

describe('calcWithholding', () => {
  it('100万円以下は10.21%、超過分は20.42%', () => {
    expect(calcWithholding(1_000_000)).toBe(102_100)
    expect(calcWithholding(1_100_000)).toBe(102_100 + 20_420)
    expect(calcWithholding(12345)).toBe(1260) // 1260.4245 → 切り捨て
    expect(calcWithholding(0)).toBe(0)
  })
})

describe('validateInvoice', () => {
  const base: Invoice = {
    id: '1', number: 'A-1', clientName: '株式会社テスト', issueDate: '2026-11-16', dueDate: '2026-12-31',
    subject: '', items: [item(1, 100)], priceMode: 'exclusive', rounding: 'floor', withholding: false, notes: '',
    issuer: { name: '山田', registrationNumber: 'T1234567890123', address: '', bank: '' },
  }
  it('正常な請求書はエラーなし', () => {
    expect(validateInvoice(base).errors).toEqual([])
  })
  it('登録番号の形式エラー・未入力警告', () => {
    expect(validateInvoice({ ...base, issuer: { ...base.issuer, registrationNumber: 'T123' } }).errors.length).toBe(1)
    const r = validateInvoice({ ...base, issuer: { ...base.issuer, registrationNumber: '' } })
    expect(r.errors).toEqual([])
    expect(r.warnings.length).toBe(1)
  })
  it('存在しない日付・NaN・小数単価を検出', () => {
    expect(validateInvoice({ ...base, issueDate: '2026-02-30' }).errors.length).toBe(1)
    expect(validateInvoice({ ...base, items: [item(NaN, 100)] }).errors.length).toBe(1)
    expect(validateInvoice({ ...base, items: [item(1, 10.5)] }).errors.length).toBe(1)
  })
})

import { buildInvoiceCsv, csvFileName, escapeCsvField } from './csv'
import { parseImport, normalizeInvoice, serializeStore, emptyStore } from './store'

describe('csv', () => {
  const inv = normalizeInvoice({ number: 'No.1/日本', issueDate: '2026-11-16', items: [{ name: '=CMD()', quantity: 1, unitPriceYen: 100, taxRate: 10 }] })
  it('BOM付きで数式注入を無効化する', () => {
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=CMD()")
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""')
    expect(escapeCsvField('-100')).toBe('-100')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName(inv)).toBe('invoice-No1-2026-11-16.csv')
  })
})

describe('store import', () => {
  it('BOM付きJSONを読み込め、往復で同一になる', () => {
    const s = emptyStore()
    s.issuer.name = '日本語の屋号'
    const back = parseImport('﻿' + serializeStore(s))
    expect(back.issuer.name).toBe('日本語の屋号')
  })
  it('不正な入力は例外', () => {
    expect(() => parseImport('not json')).toThrow()
    expect(() => parseImport('{"version":2}')).toThrow()
    expect(() => parseImport('null')).toThrow()
  })
})

describe('境界値（Round 2 で追加）', () => {
  it('上限いっぱいの数量×単価でも整数のまま正確に計算できる', () => {
    const items = Array.from({ length: 200 }, () => item(10_000, 100_000_000))
    const t = computeInvoice({ items, priceMode: 'exclusive', rounding: 'floor', withholding: false })
    expect(Number.isSafeInteger(t.grossYen)).toBe(true)
    expect(t.netYen).toBe(200 * 10_000 * 100_000_000)
    expect(t.taxYen).toBe(t.netYen / 10)
  })
  it('上限超過は検証エラー', () => {
    const base = { id: '1', number: 'A', clientName: 'c', issueDate: '2026-11-16', dueDate: '', subject: '', priceMode: 'exclusive', rounding: 'floor', withholding: false, notes: '', issuer: { name: 'x', registrationNumber: '', address: '', bank: '' } } as const
    expect(validateInvoice({ ...base, items: [item(10_001, 1)] }).errors.length).toBe(1)
    expect(validateInvoice({ ...base, items: [item(1, 100_000_001)] }).errors.length).toBe(1)
    expect(validateInvoice({ ...base, items: [item(0, 1)] }).errors.length).toBe(1)
  })
})
