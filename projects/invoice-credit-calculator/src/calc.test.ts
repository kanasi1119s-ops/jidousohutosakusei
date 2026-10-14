import { describe, expect, it } from 'vitest'
import { calcPurchase, calcAll, isValidDate, normalizeAmount, normalizeDate, taxIncluded, validatePurchase, type Purchase } from './calc'
import { findPeriod } from './schedule'
import { buildResultsCsv, buildTemplateCsv, parseCsv, parsePurchasesCsv } from './csv'
import { parseState } from './storage'

const mk = (over: Partial<Purchase> = {}): Purchase => ({
  id: 'x', date: '2026-10-01', supplier: 'テスト商店', amountYen: 11000, taxRate: 10, supplierType: 'unqualified', ...over,
})

describe('控除割合の期間境界', () => {
  it.each([
    ['2023-09-30', 1], ['2023-10-01', 0.8], ['2026-09-30', 0.8], ['2026-10-01', 0.7],
    ['2028-09-30', 0.7], ['2028-10-01', 0.5], ['2030-09-30', 0.5], ['2030-10-01', 0.3],
    ['2031-09-30', 0.3], ['2031-10-01', 0], ['2040-01-01', 0],
  ])('%s -> %s', (date, ratio) => {
    expect(findPeriod(date).ratio).toBe(ratio)
  })
})

describe('消費税額と控除額', () => {
  it('10%: 11,000円に含まれる税は1,000円', () => expect(taxIncluded(11000, 10, 'floor')).toBe(1000))
  it('8%: 10,800円に含まれる税は800円', () => expect(taxIncluded(10800, 8, 'floor')).toBe(800))
  it('端数処理の違い', () => {
    expect(taxIncluded(1005, 10, 'floor')).toBe(91)
    expect(taxIncluded(1005, 10, 'round')).toBe(91)
    expect(taxIncluded(1005, 10, 'ceil')).toBe(92)
  })
  it('免税事業者からの2026/10/1の仕入れは70%控除', () => {
    const r = calcPurchase(mk(), 'floor')
    expect(r.taxYen).toBe(1000)
    expect(r.deductibleYen).toBe(700)
    expect(r.nonDeductibleYen).toBe(300)
    expect(r.diffFromOldYen).toBe(200) // 改正前は50%（500円）
  })
  it('2026/9/30は80%、改正前後で差なし', () => {
    const r = calcPurchase(mk({ date: '2026-09-30' }), 'floor')
    expect(r.deductibleYen).toBe(800)
    expect(r.diffFromOldYen).toBe(0)
  })
  it('適格請求書発行事業者は全額控除', () => {
    const r = calcPurchase(mk({ supplierType: 'qualified' }), 'floor')
    expect(r.deductibleYen).toBe(1000)
    expect(r.nonDeductibleYen).toBe(0)
  })
  it('金額0円でもエラーにならない', () => {
    expect(calcPurchase(mk({ amountYen: 0 }), 'floor').deductibleYen).toBe(0)
  })
  it('集計', () => {
    const { summary } = calcAll([mk(), mk({ date: '2026-09-30' }), mk({ date: '2029-01-01' })], 'floor')
    expect(summary.count).toBe(3)
    expect(summary.totalDeductibleYen).toBe(700 + 800 + 500)
    expect(summary.byPeriod.map((p) => p.periodId)).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('入力の正規化・検証', () => {
  it('日付', () => {
    expect(normalizeDate('2026/10/1')).toBe('2026-10-01')
    expect(normalizeDate('２０２６－１０－０１')).toBe('2026-10-01')
    expect(normalizeDate('2026-02-30')).toBeNull()
    expect(isValidDate('2026-13-01')).toBe(false)
  })
  it('金額（全角・カンマ・円）', () => {
    expect(normalizeAmount('１２，３４５')).toBe(12345)
    expect(normalizeAmount('¥11,000円')).toBe(11000)
    expect(normalizeAmount('-5')).toBeNull()
    expect(normalizeAmount('1.5')).toBeNull()
    expect(normalizeAmount('')).toBeNull()
    expect(normalizeAmount('99999999999999999999')).toBeNull()
  })
  it('検証エラー', () => {
    expect(validatePurchase(mk({ date: 'abc' })).length).toBeGreaterThan(0)
    expect(validatePurchase(mk({ amountYen: -1 })).length).toBeGreaterThan(0)
    expect(validatePurchase(mk())).toEqual([])
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含む', () => {
    const csv = buildResultsCsv(calcAll([mk()], 'floor').results)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('控除可能額')
    expect(Array.from(new TextEncoder().encode(csv).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })
  it('数式として解釈される取引先名を無害化する', () => {
    const csv = buildResultsCsv(calcAll([mk({ supplier: '=SUM(A1)' })], 'floor').results)
    expect(csv).toContain("'=SUM(A1)")
  })
  it('引用符・カンマ・改行を含むフィールドを解析できる', () => {
    expect(parseCsv('a,"b,c","d""e\nf"\r\n1,2,3\r\n')).toEqual([['a', 'b,c', 'd"e\nf'], ['1', '2', '3']])
  })
  it('ひな形をインポートできる（BOM除去）', () => {
    let n = 0
    const out = parsePurchasesCsv(buildTemplateCsv(), () => String(n++))
    expect(out.errors).toEqual([])
    expect(out.purchases).toHaveLength(3)
    expect(out.purchases[0].supplier).toBe('サンプル商店')
  })
  it('不正行はスキップしてエラーを返す', () => {
    const out = parsePurchasesCsv('日付,取引先,税込金額,税率,取引先区分\n2026-10-01,A,1000,10,免税等\nxxx,B,1000,10,免税等\n2026-10-01,C,abc,10,免税等\n2026-10-01,D,100,5,免税等\n2026-10-01,E,100,10,不明\n2026-10-01,F\n', () => 'i')
    expect(out.purchases).toHaveLength(1)
    expect(out.errors).toHaveLength(5)
  })
  it('エクスポート→インポートの往復', () => {
    const src = [mk({ supplier: 'A,B"社' }), mk({ date: '2028-11-05', amountYen: 5400, taxRate: 8, supplierType: 'qualified' })]
    const csv = buildResultsCsv(calcAll(src, 'floor').results)
    const out = parsePurchasesCsv(csv, () => 'i')
    expect(out.errors).toEqual([])
    expect(out.purchases.map((p) => [p.date, p.supplier, p.amountYen, p.taxRate, p.supplierType])).toEqual(
      src.map((p) => [p.date, p.supplier, p.amountYen, p.taxRate, p.supplierType]),
    )
  })
})

describe('JSONバックアップ', () => {
  it('往復できる', () => {
    const s = parseState(JSON.stringify({ version: 1, rounding: 'round', purchases: [mk()] }))
    expect(s.rounding).toBe('round')
    expect(s.purchases).toHaveLength(1)
  })
  it('不正な形式は拒否する', () => {
    expect(() => parseState('not json')).toThrow()
    expect(() => parseState('{"purchases":[{"id":1}]}')).toThrow()
    expect(() => parseState('{}')).toThrow()
  })
})

describe('端数処理の網羅検証（整数演算との一致）', () => {
  it('0〜300,000円で floor/ceil/round が整数演算と一致する', () => {
    for (const rate of [10, 8] as const) {
      const den = 100 + rate
      for (let a = 0; a <= 300000; a++) {
        const num = a * rate
        const fl = Math.floor(num / den)
        const rem = num - fl * den
        const ce = rem === 0 ? fl : fl + 1
        const ro = rem * 2 >= den ? fl + 1 : fl
        if (taxIncluded(a, rate, 'floor') !== fl || taxIncluded(a, rate, 'ceil') !== ce || taxIncluded(a, rate, 'round') !== ro) {
          throw new Error(`mismatch amount=${a} rate=${rate}`)
        }
      }
    }
  })
})
