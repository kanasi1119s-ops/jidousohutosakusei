import { describe, expect, it } from 'vitest'
import { parseYen, simulate, splitAndRound, validateInput, type SimulatorInput } from './calc'

const base: SimulatorInput = {
  taxYear: 2027,
  baseSalesYen: 8_000_000,
  registered: true,
  sales10Yen: 11_000_000,
  sales8Yen: 0,
  purchases10Yen: 3_300_000,
  purchases8Yen: 0,
  exemptPurchasesYen: 0,
  transitionalRatio: 70,
  businessType: 5,
}

describe('parseYen', () => {
  it('全角数字・カンマ・円記号を許容する', () => {
    expect(parseYen('１，２３４円')).toBe(1234)
    expect(parseYen(' 1,000 ')).toBe(1000)
    expect(parseYen('¥500')).toBe(500)
  })
  it('不正な文字列はNaN', () => {
    expect(parseYen('')).toBeNaN()
    expect(parseYen('abc')).toBeNaN()
    expect(parseYen('1e5')).toBeNaN()
  })
})

describe('splitAndRound', () => {
  it('国税・地方税それぞれ100円未満を切り捨てる', () => {
    const r = splitAndRound(100_000)
    expect(r.national).toBe(78_000)
    expect(r.local).toBe(22_000)
    expect(r.total).toBe(100_000)
  })
  it('端数は切り捨て', () => {
    const r = splitAndRound(123_456)
    expect(r.national % 100).toBe(0)
    expect(r.local % 100).toBe(0)
    expect(r.total).toBeLessThanOrEqual(123_456)
  })
  it('0以下はそのまま（還付）', () => {
    expect(splitAndRound(0).total).toBe(0)
    expect(splitAndRound(-5000).total).toBe(-5000)
  })
})

describe('simulate', () => {
  it('3割特例: 売上税額100万円なら納付30万円', () => {
    const r = simulate(base)
    expect(r.salesTaxYen).toBe(1_000_000)
    const special = r.methods.find((m) => m.id === 'special')!
    expect(special.label).toBe('3割特例')
    expect(special.totalYen).toBe(300_000)
  })
  it('2026年分は2割特例', () => {
    const r = simulate({ ...base, taxYear: 2026 })
    const special = r.methods.find((m) => m.id === 'special')!
    expect(special.label).toBe('2割特例')
    expect(special.totalYen).toBe(200_000)
  })
  it('簡易課税: 第5種(50%)なら納付50万円', () => {
    const s = simulate(base).methods.find((m) => m.id === 'simplified')!
    expect(s.totalYen).toBe(500_000)
  })
  it('原則課税: 売上税額100万円-仕入税額30万円=70万円', () => {
    const g = simulate(base).methods.find((m) => m.id === 'general')!
    expect(g.totalYen).toBe(700_000)
  })
  it('仕入が多い場合は原則課税がマイナス（還付）で最有利', () => {
    const r = simulate({ ...base, purchases10Yen: 12_100_000 })
    const g = r.methods.find((m) => m.id === 'general')!
    expect(g.totalYen).toBeLessThan(0)
    expect(r.bestId).toBe('general')
  })
  it('通常は3割特例が最有利', () => {
    expect(simulate(base).bestId).toBe('special')
  })
  it('免税事業者からの仕入は経過措置割合のみ控除', () => {
    const r = simulate({ ...base, purchases10Yen: 0, exemptPurchasesYen: 1_100_000, transitionalRatio: 70 })
    expect(r.purchaseTaxYen).toBe(70_000)
  })
  it('軽減税率8%の税額計算', () => {
    const r = simulate({ ...base, sales10Yen: 0, sales8Yen: 1_080_000 })
    expect(r.salesTaxYen).toBe(80_000)
  })
  it('未登録なら特例は適用不可、免税事業者は参考として表示', () => {
    const r = simulate({ ...base, registered: false })
    expect(r.methods.find((m) => m.id === 'special')!.eligible).toBe(false)
    expect(r.bestId).not.toBe('special')
  })
  it('基準期間1,000万円超は特例不可、5,000万円超は簡易課税も不可', () => {
    const a = simulate({ ...base, baseSalesYen: 10_000_001 })
    expect(a.methods.find((m) => m.id === 'special')!.eligible).toBe(false)
    expect(a.methods.find((m) => m.id === 'simplified')!.eligible).toBe(true)
    const b = simulate({ ...base, baseSalesYen: 50_000_001 })
    expect(b.methods.find((m) => m.id === 'simplified')!.eligible).toBe(false)
    expect(b.bestId).toBe('general')
  })
  it('売上ゼロでも例外にならない', () => {
    const r = simulate({ ...base, sales10Yen: 0, purchases10Yen: 0 })
    expect(r.salesTaxYen).toBe(0)
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => {
    expect(validateInput(base)).toEqual([])
  })
  it('負の値・NaN・過大値・不正な選択肢を検出', () => {
    expect(validateInput({ ...base, sales10Yen: -1 }).length).toBe(1)
    expect(validateInput({ ...base, sales10Yen: NaN }).length).toBe(1)
    expect(validateInput({ ...base, sales10Yen: 1e13 }).length).toBe(1)
    expect(validateInput({ ...base, businessType: 9 }).length).toBe(1)
    expect(validateInput({ ...base, taxYear: 2030 as never }).length).toBe(1)
    expect(validateInput({ ...base, transitionalRatio: 60 }).length).toBe(1)
  })
})
