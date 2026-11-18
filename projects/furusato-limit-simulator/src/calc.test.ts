import { describe, it, expect } from 'vitest'
import { calculate, salaryDeduction, incomeTaxRate, parseNumber, validateInput, salaryTable } from './calc'
import { DEFAULT_INPUT, parseInputFromJsonText, inputToJsonBlob } from './storage'
import { buildCsv } from './csv'

const base = { ...DEFAULT_INPUT }

describe('給与所得控除', () => {
  it('境界値', () => {
    expect(salaryDeduction(1_000_000)).toBe(650_000)
    expect(salaryDeduction(1_625_000)).toBe(650_000)
    expect(salaryDeduction(3_600_000)).toBe(1_160_000)
    expect(salaryDeduction(5_000_000)).toBe(1_440_000)
    expect(salaryDeduction(10_000_000)).toBe(1_950_000)
  })
})

describe('上限額の計算', () => {
  it('年収500万円・独身・社保15%概算は約6.1万円（手計算: 235,500×0.2/(0.9-0.1×1.021)+2000）', () => {
    const r = calculate({ ...base, salaryYen: 5_000_000 })
    expect(r.salaryIncomeYen).toBe(3_560_000)
    expect(r.incomeTaxableYen).toBe(2_130_000)
    expect(r.incomeTaxRate).toBe(0.1)
    expect(r.residentTaxableYen).toBe(2_380_000)
    expect(r.residentTaxIncomePortionYen).toBe(235_500)
    expect(r.limitYen).toBe(61_029)
    expect(r.safeLimitYen).toBe(54_000)
  })
  it('配偶者・扶養がいると上限は下がる', () => {
    const single = calculate({ ...base, salaryYen: 6_000_000 }).limitYen
    const married = calculate({ ...base, salaryYen: 6_000_000, hasSpouse: true }).limitYen
    const withChild = calculate({ ...base, salaryYen: 6_000_000, hasSpouse: true, dependentsSpecific: 1 }).limitYen
    expect(married).toBeLessThan(single)
    expect(withChild).toBeLessThan(married)
  })
  it('iDeCoの掛金があると上限は下がる', () => {
    const a = calculate({ ...base, salaryYen: 6_000_000 }).limitYen
    const b = calculate({ ...base, salaryYen: 6_000_000, idecoYen: 276_000 }).limitYen
    expect(b).toBeLessThan(a)
  })
  it('年収が上がると上限は単調に増える', () => {
    const t = salaryTable(base)
    for (let i = 1; i < t.length; i++) expect(t[i].limitYen).toBeGreaterThanOrEqual(t[i - 1].limitYen)
  })
  it('低収入で住民税が課税されなければ上限は0', () => {
    expect(calculate({ ...base, salaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('寄附済みを引いた残額（負にならない）', () => {
    const r = calculate({ ...base, salaryYen: 5_000_000, alreadyDonatedYen: 30_000 })
    expect(r.remainingYen).toBe(31_029)
    expect(calculate({ ...base, salaryYen: 5_000_000, alreadyDonatedYen: 999_999 }).remainingYen).toBe(0)
  })
  it('社会保険料を指定した場合はその値を使う', () => {
    expect(calculate({ ...base, socialInsuranceYen: 700_000 }).socialInsuranceYen).toBe(700_000)
  })
})

describe('所得税率', () => {
  it('境界', () => {
    expect(incomeTaxRate(1_950_000)).toBe(0.05)
    expect(incomeTaxRate(1_951_000)).toBe(0.1)
    expect(incomeTaxRate(50_000_000)).toBe(0.45)
  })
})

describe('入力の正規化・検証', () => {
  it('全角数字・カンマ・円記号を数値化', () => {
    expect(parseNumber('５，０００，０００円')).toBe(5_000_000)
    expect(parseNumber(' 1,234 ')).toBe(1234)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e5')).toBeNaN()
  })
  it('異常値のバリデーション', () => {
    expect(validateInput({ ...base, salaryYen: -1 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, salaryYen: NaN }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, salaryYen: 30_000_000 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, dependentsGeneral: 99 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, dependentsGeneral: 1.5 }).length).toBeGreaterThan(0)
    expect(validateInput(base)).toEqual([])
  })
})

describe('異常系（Round 2で追加）', () => {
  it('社会保険料が給与を超えても例外にならず上限0', () => {
    const r = calculate({ ...base, salaryYen: 3_000_000, socialInsuranceYen: 9_000_000 })
    expect(r.limitYen).toBe(0)
  })
  it('2,000万円ちょうどは計算でき、超過はエラー', () => {
    expect(validateInput({ ...base, salaryYen: 20_000_000 })).toEqual([])
    expect(validateInput({ ...base, salaryYen: 20_000_001 }).length).toBeGreaterThan(0)
  })
  it('全角マイナス・小数点も正規化', () => {
    expect(parseNumber('－５')).toBe(-5)
    expect(parseNumber('１．５')).toBe(1.5)
  })
})

describe('JSON・CSV', () => {
  it('JSONの往復（BOM付きでも読める）', async () => {
    const blob = inputToJsonBlob({ ...base, salaryYen: 4_200_000, hasSpouse: true })
    expect(blob.type).toBe('application/json;charset=utf-8')
    const text = await new Promise<string>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.readAsText(blob)
    })
    expect(parseInputFromJsonText('﻿' + text).salaryYen).toBe(4_200_000)
    expect(() => parseInputFromJsonText('{"salaryYen":"x"}')).toThrow()
    expect(() => parseInputFromJsonText('not json')).toThrow()
  })
  it('CSVはBOMで始まり日本語ヘッダーを含む', () => {
    const csv = buildCsv(base, calculate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('寄附上限額の目安')
  })
})
