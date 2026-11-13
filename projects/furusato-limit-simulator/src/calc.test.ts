import { describe, expect, it } from 'vitest'
import {
  basicDeductionIncomeTax,
  calculateLimit,
  incomeTaxRate,
  salaryDeduction,
  validateInput,
  type LimitInput,
} from './calc'
import { DEFAULT_INPUT } from './storage'
import { buildDonationsCsv, escapeCsvField } from './csv'
import { summarize, validateDonation, type Donation } from './donations'
import { parseAppData } from './storage'

const base: LimitInput = { ...DEFAULT_INPUT }

describe('給与所得控除・基礎控除・税率', () => {
  it('給与所得控除の区分', () => {
    expect(salaryDeduction(5_000_000, 'residentTax')).toBe(1_440_000)
    expect(salaryDeduction(10_000_000, 'incomeTax')).toBe(1_950_000)
    expect(salaryDeduction(1_000_000, 'incomeTax')).toBe(740_000)
  })
  it('基礎控除は合計所得489万円以下で104万円', () => {
    expect(basicDeductionIncomeTax(4_890_000)).toBe(1_040_000)
    expect(basicDeductionIncomeTax(4_890_001)).toBe(670_000)
    expect(basicDeductionIncomeTax(7_000_000)).toBe(620_000)
  })
  it('所得税率の境界', () => {
    expect(incomeTaxRate(1_950_000)).toBe(0.05)
    expect(incomeTaxRate(1_951_000)).toBe(0.1)
    expect(incomeTaxRate(50_000_000)).toBe(0.45)
  })
})

describe('控除上限額', () => {
  it('年収500万円・独身・社保概算: 手計算で58,000円', () => {
    // 給与所得(住民税)=3,560,000 / 社保=725,000 / 住民税課税=2,405,000 / 所得割=240,500 / 調整控除=2,500
    // 所得割=238,000 / 所得税課税=1,795,000(5%) → 238000*0.2/(0.9-0.05*1.021)+2000=58,070 → 58,000
    const r = calculateLimit(base)
    expect(r.residentTaxTaxableYen).toBe(2_405_000)
    expect(r.adjustmentCreditYen).toBe(2_500)
    expect(r.residentTaxIncomePortionYen).toBe(238_000)
    expect(r.incomeTaxRate).toBe(0.05)
    expect(r.limitYen).toBe(58_000)
    expect(r.safeLimitYen).toBe(52_000)
  })
  it('年収が高いほど上限額は大きい（単調増加）', () => {
    let prev = -1
    for (let s = 3_000_000; s <= 12_000_000; s += 500_000) {
      const w = calculateLimit({ ...base, salaryYen: s }).limitYen
      expect(w).toBeGreaterThanOrEqual(prev)
      prev = w
    }
  })
  it('配偶者・扶養があると上限額は下がる', () => {
    const a = calculateLimit({ ...base, salaryYen: 6_000_000 }).limitYen
    const b = calculateLimit({ ...base, salaryYen: 6_000_000, spouse: 'general', dependentsSpecific: 1 }).limitYen
    expect(b).toBeLessThan(a)
  })
  it('住宅ローン控除が大きいと上限額は0になりうる', () => {
    const r = calculateLimit({ ...base, housingLoanResidentCreditYen: 9_999_999 })
    expect(r.limitYen).toBe(0)
  })
  it('年収0でもクラッシュせず0円', () => {
    expect(calculateLimit({ ...base, salaryYen: 0 }).limitYen).toBe(0)
  })
  it('社会保険料の実額指定が反映される', () => {
    const a = calculateLimit({ ...base, useActualSocialInsurance: true, socialInsuranceYen: 900_000 })
    expect(a.socialInsuranceYen).toBe(900_000)
    expect(a.limitYen).toBeLessThan(calculateLimit(base).limitYen)
  })
})

describe('入力検証', () => {
  it('負数・NaNを拒否する', () => {
    expect(validateInput({ ...base, salaryYen: -1 })).not.toHaveLength(0)
    expect(validateInput({ ...base, salaryYen: NaN })).not.toHaveLength(0)
    expect(validateInput({ ...base, dependentsGeneral: 1.5 })).not.toHaveLength(0)
    expect(validateInput(base)).toHaveLength(0)
  })
})

describe('寄附の記録', () => {
  const mk = (muni: string, amt: number, date = '2026-11-01'): Donation => ({
    id: muni + amt,
    date,
    municipality: muni,
    amountYen: amt,
    oneStopSent: false,
  })
  it('合計・残り枠・超過', () => {
    const s = summarize([mk('A', 30000), mk('B', 20000), mk('C', 9999, '2025-12-31')], 2026, 50000)
    expect(s.total).toBe(50000)
    expect(s.remainingYen).toBe(0)
    expect(s.overYen).toBe(0)
    expect(summarize([mk('A', 60000)], 2026, 50000).overYen).toBe(10000)
  })
  it('6自治体でワンストップ警告', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F'].map((m) => mk(m, 5000))
    expect(summarize(list, 2026, null).oneStopWarning).toBe(true)
    expect(summarize(list.slice(0, 5), 2026, null).oneStopWarning).toBe(false)
  })
  it('寄附の入力検証', () => {
    expect(validateDonation({ date: '2026-11-01', municipality: 'A', amountYen: 5000 })).toHaveLength(0)
    expect(validateDonation({ date: '', municipality: '', amountYen: 10 }).length).toBeGreaterThanOrEqual(3)
  })
})

describe('CSV・インポート', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含む', () => {
    const csv = buildDonationsCsv([
      { id: '1', date: '2026-11-01', municipality: '札幌市', amountYen: 10000, oneStopSent: true },
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('寄附日,自治体名')
    expect(csv).toContain('送付済み')
  })
  it('数式開始文字・カンマをエスケープする', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })
  it('不正なインポートデータを拒否する', () => {
    expect(() => parseAppData(null)).toThrow()
    expect(() => parseAppData({ input: { salaryYen: 'x' } })).toThrow()
    expect(() => parseAppData({ input: { ...base }, donations: [{ date: 1 }] })).toThrow()
    const bad = { id: 'x', date: 'abc', municipality: 'A', amountYen: -5, oneStopSent: false }
    expect(() => parseAppData({ input: { ...base }, donations: [bad] })).toThrow('寄附データが不正')
    expect(parseAppData({ input: { ...base }, donations: [] }).donations).toEqual([])
  })
})
