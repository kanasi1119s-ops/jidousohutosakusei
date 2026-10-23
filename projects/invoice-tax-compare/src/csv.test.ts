import { describe, expect, it } from 'vitest'
import { compare } from './calc'
import { buildResultsCsv, csvDownloadFileName } from './csv'
import { parseInputFromJsonText } from './storage'

const input = {
  taxYear: 2026,
  wasExempt: true,
  baseSalesYen: 5_000_000,
  sales10Yen: 5_000_000,
  sales8Yen: 0,
  purchases10Yen: 0,
  purchases8Yen: 0,
  exemptPurchases10Yen: 0,
  exemptPurchases8Yen: 0,
  exemptCreditPercent: 70,
  simplifiedCategory: 5,
  simplifiedFiled: true,
}

describe('csv', () => {
  it('BOM付きで始まり、日本語ヘッダーを含む', () => {
    const csv = buildResultsCsv(compare(input))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('方式,適用可否')
    expect(csv).toContain('2割特例')
  })
  it('カンマを含む備考は引用符で囲まれる', () => {
    const csv = buildResultsCsv(compare({ ...input, taxYear: 2027 }))
    expect(csv.split('\r\n').length).toBeGreaterThan(4)
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvDownloadFileName(new Date(2026, 9, 23))).toBe('invoice-tax-compare-2026-10-23.csv')
  })
})

describe('json import', () => {
  it('往復できる', () => {
    expect(parseInputFromJsonText(JSON.stringify(input))).toEqual(input)
  })
  it('BOM付きJSONも読める', () => {
    expect(parseInputFromJsonText('\uFEFF' + JSON.stringify(input))).toEqual(input)
  })
  it('不正な形式は例外', () => {
    expect(() => parseInputFromJsonText('{"taxYear":"x"}')).toThrow('形式が不正')
    expect(() => parseInputFromJsonText('null')).toThrow('形式が不正')
  })
})
