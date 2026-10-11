import { describe, expect, it } from 'vitest'
import {
  calculate,
  divideRound,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumber,
  withholdingTax,
  type CalcInput,
  type Line,
} from './calc'

const line = (unitPrice: number, taxRate: 0 | 8 | 10 = 10, quantity = 1): Line => ({
  name: 'x',
  quantity,
  unit: '',
  unitPrice,
  taxRate,
})
const base = (lines: Line[], over: Partial<CalcInput> = {}): CalcInput => ({
  lines,
  priceMode: 'exclusive',
  rounding: 'floor',
  withholding: false,
  ...over,
})

describe('divideRound', () => {
  it('端数処理3種', () => {
    expect(divideRound(105, 100, 'floor')).toBe(1)
    expect(divideRound(105, 100, 'round')).toBe(1)
    expect(divideRound(150, 100, 'round')).toBe(2)
    expect(divideRound(101, 100, 'ceil')).toBe(2)
  })
  it('負の値は符号対称', () => {
    expect(divideRound(-150, 100, 'round')).toBe(-2)
    expect(divideRound(-101, 100, 'floor')).toBe(-1)
  })
})

describe('calculate', () => {
  it('税抜入力・10%・切り捨て', () => {
    const r = calculate(base([line(1005)]))
    expect(r.net).toBe(1005)
    expect(r.tax).toBe(100)
    expect(r.total).toBe(1105)
  })
  it('税率ごとに1回だけ端数処理する（明細ごとに丸めない）', () => {
    // 各 15円 x 3行 = 45円。明細ごとに切り捨てると 1+1+1=3、合算してから切り捨てると 4
    const r = calculate(base([line(15), line(15), line(15)]))
    expect(r.tax).toBe(4)
  })
  it('10%と8%の混在', () => {
    const r = calculate(base([line(1000, 10), line(500, 8)]))
    expect(r.perRate[0].tax).toBe(100)
    expect(r.perRate[1].tax).toBe(40)
    expect(r.total).toBe(1000 + 100 + 500 + 40)
  })
  it('税込入力は税込合計を保持し内税を逆算する', () => {
    const r = calculate(base([line(1100)], { priceMode: 'inclusive' }))
    expect(r.total).toBe(1100)
    expect(r.tax).toBe(100)
    expect(r.net).toBe(1000)
  })
  it('税込入力・8%', () => {
    const r = calculate(base([line(540, 8)], { priceMode: 'inclusive' }))
    expect(r.tax).toBe(40)
    expect(r.net).toBe(500)
  })
  it('非課税は税額0', () => {
    const r = calculate(base([line(3000, 0)]))
    expect(r.tax).toBe(0)
    expect(r.total).toBe(3000)
  })
  it('値引き（負数）を含められる', () => {
    const r = calculate(base([line(10000), line(-1000)]))
    expect(r.net).toBe(9000)
    expect(r.tax).toBe(900)
  })
  it('空の明細は 0', () => {
    const r = calculate(base([]))
    expect(r.total).toBe(0)
    expect(r.payable).toBe(0)
  })
  it('数量が小数でも誤差なく金額化する', () => {
    expect(lineAmount(line(100, 10, 1.1))).toBe(110)
    expect(lineAmount(line(333, 10, 0.5))).toBe(167)
  })
  it('極端に大きい値でもオーバーフローしない', () => {
    const r = calculate(base([line(1e8, 10, 1e6), line(1e8, 10, 1e6)]))
    expect(Number.isSafeInteger(r.total)).toBe(true)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%', () => {
    expect(withholdingTax(100000)).toBe(10210)
    expect(withholdingTax(1000000)).toBe(102100)
  })
  it('100万円超は超過分20.42%', () => {
    expect(withholdingTax(2000000)).toBe(102100 + 204200)
  })
  it('1円未満切り捨て', () => {
    expect(withholdingTax(12345)).toBe(1260)
  })
  it('0以下は0', () => {
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
  })
  it('請求額は源泉徴収額を差し引く', () => {
    const r = calculate(base([line(100000)], { withholding: true }))
    expect(r.total).toBe(110000)
    expect(r.withholdingAmount).toBe(10210)
    expect(r.payable).toBe(110000 - 10210)
  })
})

describe('parseNumber', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumber('１２,３４５')).toBe(12345)
    expect(parseNumber('￥1,000円')).toBe(1000)
    expect(parseNumber('１．５')).toBe(1.5)
  })
  it('全角マイナスを解釈する', () => {
    expect(parseNumber('－500')).toBe(-500)
    expect(parseNumber('−500')).toBe(-500)
  })
  it('不正な文字列は 0', () => {
    expect(parseNumber('abc')).toBe(0)
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('1e5')).toBe(0)
    expect(parseNumber('1.2.3')).toBe(0)
  })
})

describe('registration number', () => {
  it('形式チェック', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('t1234567890123')).toBe(false)
  })
  it('全角・小文字・空白を正規化する', () => {
    expect(normalizeRegistrationNumber(' ｔ１２３４５６７８９０１２３ ')).toBe('T1234567890123')
  })
})
