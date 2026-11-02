import { describe, expect, it } from 'vitest'
import { calcLimit, validateLimitInput, type LimitInput } from './calc'
import { parseNumber } from './parse'
import { daysUntilYearEnd, summarize, validateDonation, type Donation } from './tracker'
import { buildDonationsCsv, parseDonationsCsv } from './csv'

const base: LimitInput = {
  salaryYen: 5_000_000, socialInsuranceRate: 0.15, socialInsuranceYen: null, hasSpouse: false,
  generalDependents: 0, specificDependents: 0, elderlyDependents: 0, otherDeductionYen: 0,
}

describe('calcLimit', () => {
  it('年収500万円・独身の上限が一般的な目安（5〜7万円台）に収まる', () => {
    const r = calcLimit(base)
    expect(r.limitYen).toBeGreaterThan(50_000)
    expect(r.limitYen).toBeLessThan(80_000)
    expect(r.limitYen % 1000).toBe(0)
  })
  it('年収が高いほど上限が大きい', () => {
    expect(calcLimit({ ...base, salaryYen: 8_000_000 }).limitYen).toBeGreaterThan(calcLimit(base).limitYen)
  })
  it('配偶者・扶養がいると上限は下がる', () => {
    expect(calcLimit({ ...base, hasSpouse: true }).limitYen).toBeLessThan(calcLimit(base).limitYen)
    expect(calcLimit({ ...base, specificDependents: 1 }).limitYen).toBeLessThan(calcLimit(base).limitYen)
  })
  it('低年収（100万円）では上限が0', () => {
    expect(calcLimit({ ...base, salaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('安全側の目安は上限の90％以下', () => {
    const r = calcLimit(base)
    expect(r.safeLimitYen).toBeLessThanOrEqual(r.limitYen * 0.9)
  })
  it('社会保険料の実額指定が率より優先される', () => {
    expect(calcLimit({ ...base, socialInsuranceYen: 1_000_000 }).limitYen).toBeLessThan(calcLimit(base).limitYen)
  })
  it('負数・非数・小数の人数を検出する', () => {
    expect(validateLimitInput({ ...base, salaryYen: -1 }).length).toBe(1)
    expect(validateLimitInput({ ...base, salaryYen: NaN }).length).toBe(1)
    expect(validateLimitInput({ ...base, generalDependents: 1.5 }).length).toBe(1)
    expect(validateLimitInput(base)).toEqual([])
  })
})

describe('parseNumber', () => {
  it('全角数字・カンマ・円を許容する', () => {
    expect(parseNumber('５，０００，０００円')).toBe(5_000_000)
    expect(parseNumber('15.5')).toBe(15.5)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
})

const d = (name: string, date: string, amt: number, one = true): Donation => ({ id: name + date, municipality: name, date, amountYen: amt, oneStop: one })

describe('summarize', () => {
  it('当年分のみ集計し、残り枠・自治体数を出す', () => {
    const s = summarize([d('A市', '2026-03-01', 30000), d('B町', '2026-04-01', 20000), d('C村', '2025-12-31', 99999)], 2026, 60000)
    expect(s.totalYen).toBe(50000)
    expect(s.municipalities).toBe(2)
    expect(s.remainingYen).toBe(10000)
    expect(s.burdenYen).toBe(2000)
  })
  it('上限超過分は自己負担に加算され、6自治体以上でワンストップ不可', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => d(n, '2026-05-01', 20000))
    const s = summarize(list, 2026, 100000)
    expect(s.overYen).toBe(20000)
    expect(s.burdenYen).toBe(22000)
    expect(s.oneStopOk).toBe(false)
  })
})

describe('validateDonation / date', () => {
  it('不正入力を検出する', () => {
    expect(validateDonation({ municipality: '', date: '2026-02-30', amountYen: 0, oneStop: true }).length).toBe(3)
    expect(validateDonation({ municipality: 'A市', date: '2026-02-28', amountYen: 10000, oneStop: true })).toEqual([])
  })
  it('年末までの日数', () => {
    expect(daysUntilYearEnd(2026, new Date(2026, 10, 2))).toBe(59)
  })
})

describe('CSV', () => {
  it('BOM付きで出力し、往復できる（日本語・カンマ・引用符）', () => {
    const list = [d('北海道 上士幌町', '2026-05-01', 10000), d('A,"市"', '2026-06-01', 5000, false)]
    const csv = buildDonationsCsv(list)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const back = parseDonationsCsv(csv)
    expect(back.map((x) => [x.municipality, x.date, x.amountYen, x.oneStop])).toEqual(
      list.map((x) => [x.municipality, x.date, x.amountYen, x.oneStop]),
    )
  })
  it('数式として解釈される先頭記号を無効化し、読込時に戻す', () => {
    const csv = buildDonationsCsv([d('=SUM(A1)', '2026-05-01', 1000)])
    expect(csv).toContain("'=SUM(A1)")
    expect(parseDonationsCsv(csv)[0].municipality).toBe('=SUM(A1)')
  })
  it('不正なCSVはエラー', () => {
    expect(() => parseDonationsCsv('a,b\r\n1,2')).toThrow()
    expect(() => parseDonationsCsv('自治体名,寄附日,寄附額(円),ワンストップ特例希望\r\nA市,2026-13-01,1000,希望')).toThrow()
  })
})
