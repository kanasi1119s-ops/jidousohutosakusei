import { describe, expect, it } from 'vitest'
import { parseInputFromJsonText } from './storage'

const valid = {
  year: 2027,
  salesStandardYen: 1,
  salesReducedYen: 0,
  purchasesStandardYen: 0,
  purchasesReducedYen: 0,
  businessType: 5,
  registeredToBecomeTaxable: true,
  baseSalesYen: 0,
}

describe('parseInputFromJsonText', () => {
  it('正しいJSON（BOM付き含む）を受け付ける', () => {
    expect(parseInputFromJsonText(JSON.stringify(valid)).year).toBe(2027)
    expect(parseInputFromJsonText('﻿' + JSON.stringify(valid)).businessType).toBe(5)
  })
  it('不正な形式を拒否する', () => {
    expect(() => parseInputFromJsonText('not json')).toThrow()
    expect(() => parseInputFromJsonText('null')).toThrow()
    expect(() => parseInputFromJsonText(JSON.stringify({ ...valid, year: 2030 }))).toThrow()
    expect(() => parseInputFromJsonText(JSON.stringify({ ...valid, salesStandardYen: '1' }))).toThrow()
    expect(() => parseInputFromJsonText(JSON.stringify({ ...valid, businessType: 9 }))).toThrow()
  })
})
