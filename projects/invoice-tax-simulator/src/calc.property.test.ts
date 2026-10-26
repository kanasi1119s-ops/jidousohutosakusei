import { describe, expect, it } from 'vitest'
import { simulate } from './calc'

// 国税・地方税を別々に100円未満切り捨てるため、目減りは最大でも約230円。
// 擬似乱数（再現可能）で多数の入力を生成し、独立した式との整合と不変条件を確認する
describe('simulate: ランダム入力での整合性', () => {
  it('3000ケースで税額の関係式・100円未満切り捨て・整数性が成り立つ', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let i = 0; i < 3000; i++) {
      const s10 = Math.floor(rnd() * 2e7)
      const s8 = Math.floor(rnd() * 5e6)
      const p10 = Math.floor(rnd() * 1.5e7)
      const p8 = Math.floor(rnd() * 3e6)
      const r = simulate({
        taxYear: 2027,
        baseSalesYen: 5e6,
        registered: true,
        sales10Yen: s10,
        sales8Yen: s8,
        purchases10Yen: p10,
        purchases8Yen: p8,
        exemptPurchasesYen: 0,
        transitionalRatio: 70,
        businessType: 1 + Math.floor(rnd() * 6),
      })
      const st = Math.floor((s10 * 10) / 110) + Math.floor((s8 * 8) / 108)
      const pt = Math.floor((p10 * 10) / 110) + Math.floor((p8 * 8) / 108)
      expect(r.salesTaxYen).toBe(st)
      expect(r.purchaseTaxYen).toBe(pt)

      const special = r.methods.find((m) => m.id === 'special')!
      const general = r.methods.find((m) => m.id === 'general')!
      const cap = Math.floor(st * 0.3)
      expect(special.totalYen).toBeLessThanOrEqual(cap)
      expect(special.totalYen).toBeGreaterThanOrEqual(cap - 300)
      if (st - pt > 0) {
        expect(general.totalYen).toBeLessThanOrEqual(st - pt)
        expect(general.totalYen).toBeGreaterThanOrEqual(st - pt - 300)
      } else {
        expect(general.totalYen).toBe(st - pt)
      }
      for (const m of r.methods) {
        expect(Object.is(m.totalYen, -0)).toBe(false)
        expect(Number.isInteger(m.totalYen)).toBe(true)
        if (m.totalYen > 0) expect(m.nationalYen % 100).toBe(0)
      }
    }
  })
})
