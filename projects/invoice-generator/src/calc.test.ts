import { describe, it, expect } from 'vitest'
import {
  computeTotals,
  consumptionTaxYen,
  isValidRegistrationNumber,
  lineAmountYen,
  nextInvoiceNumber,
  normalizeRegistrationNumber,
  parseNumberInput,
  validateInvoiceForIssue,
  withholdingTaxYen,
} from './calc'

describe('parseNumberInput', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumberInput('１，２３４')).toBe(1234)
    expect(parseNumberInput('¥5,000円')).toBe(5000)
    expect(parseNumberInput('１．５')).toBe(1.5)
    expect(parseNumberInput('－３００')).toBe(-300)
  })
  it('解釈できない入力は NaN', () => {
    expect(parseNumberInput('')).toBeNaN()
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('1.2.3')).toBeNaN()
  })
})

describe('登録番号', () => {
  it('全角・ハイフン混じりを正規化して検証する', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４-５６７８ 90123')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('消費税・端数処理', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    expect(consumptionTaxYen(1005, 10, 'floor')).toBe(100)
    expect(consumptionTaxYen(1005, 10, 'round')).toBe(101)
    expect(consumptionTaxYen(1005, 10, 'ceil')).toBe(101)
    expect(consumptionTaxYen(1004, 8, 'round')).toBe(80)
    expect(consumptionTaxYen(1006, 8, 'ceil')).toBe(81)
  })
  it('値引き（負の小計）は絶対値で処理して符号を戻す', () => {
    expect(consumptionTaxYen(-1005, 10, 'floor')).toBe(-100)
    expect(consumptionTaxYen(-1005, 10, 'round')).toBe(-101)
  })
  it('明細金額は円未満切り捨て', () => {
    expect(lineAmountYen({ quantity: 1.5, unitPriceYen: 333 })).toBe(499)
    expect(lineAmountYen({ quantity: 3, unitPriceYen: 0.1 })).toBe(0)
    expect(lineAmountYen({ quantity: 1, unitPriceYen: -500 })).toBe(-500)
  })
})

describe('源泉徴収税', () => {
  it('100万円以下は10.21%', () => {
    expect(withholdingTaxYen(100_000)).toBe(10_210)
    expect(withholdingTaxYen(1_000_000)).toBe(102_100)
    expect(withholdingTaxYen(12_345)).toBe(1_260)
  })
  it('100万円超は超過分に20.42%', () => {
    expect(withholdingTaxYen(1_500_000)).toBe(102_100 + 102_100)
    expect(withholdingTaxYen(1_000_001)).toBe(102_100)
  })
  it('0以下は0', () => {
    expect(withholdingTaxYen(0)).toBe(0)
    expect(withholdingTaxYen(-1)).toBe(0)
  })
})

describe('computeTotals', () => {
  const items = [
    { name: 'A', quantity: 1, unitPriceYen: 10000, taxRate: 10 as const },
    { name: 'B', quantity: 2, unitPriceYen: 505, taxRate: 10 as const },
    { name: 'C', quantity: 1, unitPriceYen: 1000, taxRate: 8 as const },
  ]
  it('税率別に集計する', () => {
    const t = computeTotals(items, 'floor', false)
    expect(t.byRate).toEqual([
      { rate: 10, subtotalYen: 11010, taxYen: 1101 },
      { rate: 8, subtotalYen: 1000, taxYen: 80 },
    ])
    expect(t.subtotalYen).toBe(12010)
    expect(t.taxYen).toBe(1181)
    expect(t.totalYen).toBe(13191)
  })
  it('源泉徴収を差し引く', () => {
    const t = computeTotals(items, 'floor', true)
    expect(t.withholdingYen).toBe(1226)
    expect(t.totalYen).toBe(13191 - 1226)
  })
  it('明細が空なら0円', () => {
    expect(computeTotals([], 'floor', true).totalYen).toBe(0)
  })
})

describe('nextInvoiceNumber', () => {
  it('同月の最大連番+1を返す', () => {
    const d = new Date(2026, 9, 20)
    expect(nextInvoiceNumber([], d)).toBe('202610-001')
    expect(nextInvoiceNumber(['202610-001', '202610-007', '202609-099', 'x'], d)).toBe('202610-008')
  })
})

describe('validateInvoiceForIssue', () => {
  const ok = {
    issuerName: '山田商店',
    registrationNumber: 'T1234567890123',
    clientName: '株式会社サンプル',
    issueDate: '2026-10-20',
    items: [{ name: '制作費', quantity: 1, unitPriceYen: 1000, taxRate: 10 as const }],
  }
  it('必須項目が揃っていれば問題なし', () => {
    expect(validateInvoiceForIssue(ok)).toEqual([])
  })
  it('不足を検出する', () => {
    const msgs = validateInvoiceForIssue({ ...ok, issuerName: '', registrationNumber: 'T12', items: [] }).map(
      (i) => i.message,
    )
    expect(msgs.length).toBe(3)
  })
})
