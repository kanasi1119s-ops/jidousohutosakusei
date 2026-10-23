import { describe, expect, it } from 'vitest'
import { compare, purchaseNationalTax, salesNationalTax, validateInput, type CompareInput } from './calc'

const base: CompareInput = {
  taxYear: 2026,
  wasExempt: true,
  baseSalesYen: 5_000_000,
  sales10Yen: 5_000_000,
  sales8Yen: 0,
  purchases10Yen: 1_100_000,
  purchases8Yen: 0,
  exemptPurchases10Yen: 0,
  exemptPurchases8Yen: 0,
  exemptCreditPercent: 70,
  simplifiedCategory: 5,
  simplifiedFiled: true,
}

describe('国税ベースの計算', () => {
  it('売上500万円(10%)の国税は39万円', () => {
    expect(salesNationalTax(5_000_000, 0)).toBe(390_000)
  })
  it('課税標準額は千円未満切り捨て', () => {
    expect(salesNationalTax(1_000_999, 0)).toBe(78_000)
  })
  it('税込仕入110万円(10%)の国税分は7.8万円', () => {
    expect(purchaseNationalTax(1_100_000, 0)).toBe(78_000)
  })
  it('軽減税率8%の仕入: 税込108万円で国税6.24万円', () => {
    expect(purchaseNationalTax(0, 1_080_000)).toBe(62_400)
  })
})

describe('compare', () => {
  it('2割特例: 国税39万円の20%=7.8万円、地方2.2万円、合計10万円', () => {
    const r = compare(base)
    const m = r.methods.find((x) => x.id === 'special20')!
    expect(m.eligible).toBe(true)
    expect(m.nationalYen).toBe(78_000)
    expect(m.localYen).toBe(22_000)
    expect(m.totalYen).toBe(100_000)
  })
  it('本則課税: 売上国税39万円−仕入国税7.8万円=31.2万円', () => {
    const m = compare(base).methods.find((x) => x.id === 'standard')!
    expect(m.nationalYen).toBe(312_000)
    expect(m.totalYen).toBe(400_000)
  })
  it('簡易課税(第5種50%): 国税19.5万円', () => {
    const m = compare(base).methods.find((x) => x.id === 'simplified')!
    expect(m.nationalYen).toBe(195_000)
  })
  it('令和8年分では2割特例が最小として推奨される', () => {
    expect(compare(base).bestId).toBe('special20')
  })
  it('令和9年分では2割特例は対象外、3割特例が対象', () => {
    const r = compare({ ...base, taxYear: 2027 })
    expect(r.methods.find((x) => x.id === 'special20')!.eligible).toBe(false)
    expect(r.methods.find((x) => x.id === 'special30')!.eligible).toBe(true)
  })
  it('免税事業者でなかった場合は特例対象外', () => {
    const r = compare({ ...base, wasExempt: false })
    expect(r.methods.find((x) => x.id === 'special20')!.eligible).toBe(false)
    expect(r.bestId).not.toBe('special20')
  })
  it('基準期間売上が1,000万円超だと特例対象外、5,000万円超で簡易も対象外', () => {
    const r = compare({ ...base, baseSalesYen: 60_000_000 })
    expect(r.methods.find((x) => x.id === 'special20')!.eligible).toBe(false)
    expect(r.methods.find((x) => x.id === 'simplified')!.eligible).toBe(false)
    expect(r.bestId).toBe('standard')
  })
  it('届出未提出なら簡易課税は対象外', () => {
    const r = compare({ ...base, simplifiedFiled: false })
    expect(r.methods.find((x) => x.id === 'simplified')!.eligible).toBe(false)
  })
  it('仕入が大きく本則で還付になる場合は還付(負の合計)になる', () => {
    const r = compare({ ...base, purchases10Yen: 11_000_000, wasExempt: false })
    const m = r.methods.find((x) => x.id === 'standard')!
    expect(m.isRefund).toBe(true)
    expect(m.totalYen).toBeLessThan(0)
    expect(r.bestId).toBe('standard')
  })
  it('免税事業者等からの仕入は経過措置割合のみ控除される', () => {
    const r = compare({ ...base, purchases10Yen: 0, exemptPurchases10Yen: 1_100_000, exemptCreditPercent: 70 })
    const m = r.methods.find((x) => x.id === 'standard')!
    expect(m.nationalYen).toBe(Math.floor((390_000 - 54_600) / 100) * 100)
  })
  it('売上ゼロでも納税額0円', () => {
    const r = compare({ ...base, sales10Yen: 0, purchases10Yen: 0 })
    expect(r.methods.every((m) => m.totalYen === 0)).toBe(true)
  })
})

describe('上限値', () => {
  it('上限額の入力でも整数精度の範囲で計算できる', () => {
    const max = 4_999_999_999
    const r = compare({ ...base, purchases10Yen: max, purchases8Yen: max, exemptPurchases10Yen: max, exemptPurchases8Yen: max })
    expect(Number.isSafeInteger(r.methods[3].nationalYen)).toBe(true)
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => {
    expect(validateInput(base)).toEqual([])
  })
  it('負数・NaN・巨大値・不正な割合を検出する', () => {
    expect(validateInput({ ...base, sales10Yen: -1 })[0]).toContain('0以上')
    expect(validateInput({ ...base, sales8Yen: NaN })[0]).toContain('数値')
    expect(validateInput({ ...base, purchases10Yen: 1e12 })[0]).toContain('以下')
    expect(validateInput({ ...base, exemptCreditPercent: 120 })[0]).toContain('0〜100')
    expect(validateInput({ ...base, taxYear: 1999 })[0]).toContain('年分')
  })
})
