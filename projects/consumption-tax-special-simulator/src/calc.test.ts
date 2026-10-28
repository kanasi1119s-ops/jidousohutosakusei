import { describe, expect, it } from 'vitest'
import { parseYen, simulate, taxFromInclusive, validateInput, type SimulatorInput } from './calc'

const base: SimulatorInput = {
  year: 2027,
  salesStandardYen: 5_500_000, // 税額 500,000
  salesReducedYen: 0,
  purchasesStandardYen: 1_100_000, // 税額 100,000
  purchasesReducedYen: 0,
  businessType: 5,
  registeredToBecomeTaxable: true,
  baseSalesYen: 0,
}

const get = (r: ReturnType<typeof simulate>, id: string) => r.methods.find((m) => m.id === id)!

describe('taxFromInclusive', () => {
  it('10%と8%を割り戻して切り捨てる', () => {
    expect(taxFromInclusive(1100, 10)).toBe(100)
    expect(taxFromInclusive(1080, 8)).toBe(80)
    expect(taxFromInclusive(1000, 10)).toBe(90) // 90.909... 切り捨て
  })
})

describe('simulate', () => {
  it('各方式の納付税額を計算する（2027年）', () => {
    const r = simulate(base)
    expect(get(r, 'standard').payableYen).toBe(400_000)
    expect(get(r, 'simplified').payableYen).toBe(250_000) // 第五種50%
    expect(get(r, 'three-wari').payableYen).toBe(150_000)
    expect(get(r, 'three-wari').available).toBe(true)
    expect(get(r, 'two-wari').available).toBe(false)
    expect(r.bestId).toBe('three-wari')
    expect(r.savingVsStandardYen).toBe(250_000)
  })

  it('2026年は2割特例が使え、3割特例は使えない', () => {
    const r = simulate({ ...base, year: 2026 })
    expect(get(r, 'two-wari').available).toBe(true)
    expect(get(r, 'two-wari').payableYen).toBe(100_000)
    expect(get(r, 'three-wari').available).toBe(false)
    expect(r.bestId).toBe('two-wari')
  })

  it('登録を機に課税事業者になっていなければ特例は使えない', () => {
    const r = simulate({ ...base, registeredToBecomeTaxable: false })
    expect(get(r, 'three-wari').available).toBe(false)
    expect(r.bestId).toBe('simplified')
  })

  it('仕入が多いと本則課税が有利（還付も表現できる）', () => {
    const r = simulate({ ...base, purchasesStandardYen: 11_000_000, registeredToBecomeTaxable: false, businessType: 6 })
    expect(get(r, 'standard').payableYen).toBe(-500_000)
    expect(r.bestId).toBe('standard')
  })

  it('基準期間売上が5,000万円超だと簡易課税は選べない', () => {
    const r = simulate({ ...base, baseSalesYen: 50_000_001 })
    expect(get(r, 'simplified').available).toBe(false)
    expect(get(r, 'three-wari').available).toBe(false)
  })

  it('軽減税率の売上を合算する', () => {
    const r = simulate({ ...base, salesStandardYen: 1100, salesReducedYen: 1080, purchasesStandardYen: 0 })
    expect(get(r, 'standard').salesTaxYen).toBe(180)
  })

  it('すべて0でもクラッシュしない', () => {
    const r = simulate({ ...base, salesStandardYen: 0, purchasesStandardYen: 0 })
    expect(get(r, 'standard').payableYen).toBe(0)
  })
})

describe('validateInput / parseYen', () => {
  it('負数・非数・巨大値を検出する', () => {
    expect(validateInput({ ...base, salesStandardYen: -1 })).toHaveLength(1)
    expect(validateInput({ ...base, salesStandardYen: NaN })).toHaveLength(1)
    expect(validateInput({ ...base, salesStandardYen: 1e12 })).toHaveLength(1)
    expect(validateInput(base)).toHaveLength(0)
  })

  it('全角数字・カンマ・円を許容する', () => {
    expect(parseYen('１，２３４，５６７円')).toBe(1234567)
    expect(parseYen('')).toBe(0)
    expect(parseYen('12.5')).toBeNaN()
    expect(parseYen('abc')).toBeNaN()
    expect(parseYen('-100')).toBe(-100)
  })
})
