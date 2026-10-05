import { describe, expect, it } from 'vitest'
import { compute, emptyInput, parseYen, simplifiedDeduction, validateInput, type TaxInput } from './calc'

function serviceBusiness(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    ...emptyInput(2027),
    sales10: [0, 0, 0, 0, 5_500_000, 0], // 第5種・税込550万円 → 税抜500万円
    purchases10: 2_200_000, // 税込220万円 → 消費税20万円
    ...overrides,
  }
}

const byId = (r: ReturnType<typeof compute>, id: string) => r.methods.find((m) => m.id === id)!

describe('compute: 手計算との一致', () => {
  const r = compute(serviceBusiness())

  it('売上税額（国税）は 500万円×7.8% = 39万円', () => {
    expect(byId(r, 'standard').salesTaxYen).toBe(390_000)
  })

  it('3割特例: 納付税額は売上税額の3割（国税117,000円＋地方33,000円＝15万円）', () => {
    const m = byId(r, 'threeTenths')
    expect(m.available).toBe(true)
    expect(m.nationalTaxYen).toBe(117_000)
    expect(m.localTaxYen).toBe(33_000)
    expect(m.totalYen).toBe(150_000)
  })

  it('簡易課税（第5種・みなし仕入率50%）: 合計25万円', () => {
    const m = byId(r, 'simplified')
    expect(m.totalYen).toBe(250_000)
  })

  it('本則課税: 合計30万円（仕入税額控除 15.6万円）', () => {
    const m = byId(r, 'standard')
    expect(m.deductionYen).toBe(156_000)
    expect(m.totalYen).toBe(300_000)
  })

  it('2027年は2割特例が使えない', () => {
    expect(byId(r, 'twoTenths').available).toBe(false)
  })

  it('最も有利な方式（3割特例）が推奨される', () => {
    expect(r.recommendedId).toBe('threeTenths')
  })
})

describe('特例の適用要件', () => {
  it('2026年分は2割特例が使え、3割特例は使えない', () => {
    const r = compute(serviceBusiness({ year: 2026 }))
    expect(byId(r, 'twoTenths').available).toBe(true)
    expect(byId(r, 'twoTenths').totalYen).toBe(100_000)
    expect(byId(r, 'threeTenths').available).toBe(false)
  })

  it('2029年分以降は2割・3割特例とも使えない', () => {
    const r = compute(serviceBusiness({ year: 2029 }))
    expect(byId(r, 'twoTenths').available).toBe(false)
    expect(byId(r, 'threeTenths').available).toBe(false)
    expect(r.recommendedId).toBe('simplified')
  })

  it('登録を機に課税事業者になったのでない場合は特例対象外', () => {
    const r = compute(serviceBusiness({ convertedFromExempt: false }))
    expect(byId(r, 'threeTenths').available).toBe(false)
  })

  it('基準期間の課税売上高が1,000万円超なら特例対象外、5,000万円超なら簡易課税も不可', () => {
    const over10m = compute(serviceBusiness({ baseYearSalesYen: 10_000_001 }))
    expect(byId(over10m, 'threeTenths').available).toBe(false)
    expect(byId(over10m, 'simplified').available).toBe(true)
    const over50m = compute(serviceBusiness({ baseYearSalesYen: 50_000_001 }))
    expect(byId(over50m, 'simplified').available).toBe(false)
    expect(over50m.recommendedId).toBe('standard')
  })

  it('基準期間の課税売上高がちょうど1,000万円なら特例対象', () => {
    const r = compute(serviceBusiness({ baseYearSalesYen: 10_000_000 }))
    expect(byId(r, 'threeTenths').available).toBe(true)
  })
})

describe('免税事業者等からの仕入（経過措置）', () => {
  it('2027年は全期間70%控除。税込110万円の仕入 → 控除54,600円、控除不可23,400円', () => {
    const r = compute(serviceBusiness({ purchases10: 0, exemptPurchasesFirst: 1_100_000 }))
    expect(byId(r, 'standard').deductionYen).toBe(54_600)
    expect(r.lostDeductionYen).toBe(23_400)
  })

  it('2026年は10/1を境に80%→70%', () => {
    const r = compute(
      serviceBusiness({
        year: 2026,
        purchases10: 0,
        exemptPurchasesFirst: 1_100_000, // 78,000 × 0.8
        exemptPurchasesSecond: 1_100_000, // 78,000 × 0.7
      }),
    )
    expect(byId(r, 'standard').deductionYen).toBe(62_400 + 54_600)
  })

  it('2031年の10/1以降は控除不可（0%）', () => {
    const r = compute(serviceBusiness({ year: 2031, purchases10: 0, exemptPurchasesSecond: 1_100_000 }))
    expect(byId(r, 'standard').deductionYen).toBe(0)
    expect(r.lostDeductionYen).toBe(78_000)
  })
})

describe('還付・ゼロ', () => {
  it('売上ゼロなら納税額0', () => {
    const r = compute(emptyInput(2027))
    for (const m of r.methods) expect(m.totalYen).toBe(0)
  })

  it('本則課税で仕入が売上を上回ると還付（負の値）になる', () => {
    const r = compute(serviceBusiness({ purchases10: 11_000_000 }))
    expect(byId(r, 'standard').totalYen).toBeLessThan(0)
    expect(r.recommendedId).toBe('standard')
  })
})

describe('軽減税率8%', () => {
  it('税込1,080,000円（税抜100万円）の軽減税率売上 → 国税分は62,400円', () => {
    const r = compute({ ...emptyInput(2027), sales8: [0, 0, 0, 1_080_000, 0, 0] })
    expect(byId(r, 'standard').salesTaxYen).toBe(62_400)
    // 3割特例: 国税 18,720 → 18,700、地方 floor100(18,700×22/78=5,274) → 5,200
    expect(byId(r, 'threeTenths').nationalTaxYen).toBe(18_700)
    expect(byId(r, 'threeTenths').localTaxYen).toBe(5_200)
  })
})

describe('simplifiedDeduction（75%ルール）', () => {
  it('1つの区分が75%以上ならその区分のみなし仕入率を全体に適用', () => {
    const { deduction, note } = simplifiedDeduction([80, 0, 0, 0, 20, 0])
    expect(deduction).toBe(90)
    expect(note).toContain('75%以上')
  })

  it('2区分の合計が75%以上なら高い率の区分はその率、残りは低い方の率', () => {
    // 第1種40・第5種40・第6種20: 40×0.9 + 60×0.5 = 66（原則は 36+20+8 = 64）
    expect(simplifiedDeduction([40, 0, 0, 0, 40, 20]).deduction).toBe(66)
  })

  it('特例が不利な場合は原則計算を採用', () => {
    // 第5種のみ: 原則 = 特例 = 50
    expect(simplifiedDeduction([0, 0, 0, 0, 100, 0]).deduction).toBe(50)
  })

  it('75%に満たない場合は原則（加重平均）', () => {
    // 第1種・第3種・第5種を 100 ずつ: 100×(0.9+0.7+0.5) = 210
    expect(simplifiedDeduction([100, 0, 100, 0, 100, 0]).deduction).toBe(210)
  })
})

describe('parseYen', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseYen('５，５００，０００円')).toBe(5_500_000)
    expect(parseYen('¥1,000')).toBe(1000)
  })
  it('空文字は0、解釈不能はNaN', () => {
    expect(parseYen('')).toBe(0)
    expect(parseYen('abc')).toBeNaN()
    expect(parseYen('1e5')).toBeNaN()
  })
})

describe('validateInput', () => {
  it('負数・非数・巨大値を検出する', () => {
    expect(validateInput(serviceBusiness({ purchases10: -1 })).join()).toContain('0以上')
    expect(validateInput(serviceBusiness({ purchases8: NaN })).join()).toContain('数値')
    expect(validateInput(serviceBusiness({ baseYearSalesYen: 1e15 })).join()).toContain('大きすぎ')
  })
  it('正常な入力ではエラーなし', () => {
    expect(validateInput(serviceBusiness())).toEqual([])
  })
})
