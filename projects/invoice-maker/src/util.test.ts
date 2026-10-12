import { describe, expect, it } from 'vitest'
import {
  bumpInvoiceNumber,
  formatDateJa,
  formatYen,
  isValidRegistrationNumber,
  parseNumberInput,
  sanitizeFileNamePart,
} from './util'

describe('parseNumberInput', () => {
  it('全角数字・カンマ・円を許容する', () => {
    expect(parseNumberInput('１２，３４５円')).toBe(12345)
    expect(parseNumberInput(' 1,000 ')).toBe(1000)
    expect(parseNumberInput('１．５')).toBe(1.5)
    expect(parseNumberInput('−300')).toBe(-300)
  })
  it('解釈できなければNaN', () => {
    expect(parseNumberInput('')).toBeNaN()
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('1e5')).toBeNaN()
  })
})

describe('登録番号', () => {
  it('T+13桁（全角・ハイフン混在も正規化）を受け付ける', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４－５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('t-1234567890123')).toBe(true)
  })
  it('不正な形式は拒否する', () => {
    expect(isValidRegistrationNumber('')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('T12345678901234')).toBe(false)
  })
})

describe('その他', () => {
  it('ファイル名は英数字のみになる', () => {
    expect(sanitizeFileNamePart('INV-2026/10 請求')).toBe('INV-2026-10')
    expect(sanitizeFileNamePart('請求書')).toBe('invoice')
  })
  it('請求書番号を1つ進める', () => {
    expect(bumpInvoiceNumber('INV-20261012-001')).toBe('INV-20261012-002')
    expect(bumpInvoiceNumber('A-099')).toBe('A-100')
    expect(bumpInvoiceNumber('No.7号')).toBe('No.8号')
    expect(bumpInvoiceNumber('abc')).toBe('abc-2')
  })
  it('日付・金額の整形', () => {
    expect(formatDateJa('2026-10-05')).toBe('2026年10月5日')
    expect(formatDateJa('')).toBe('')
    expect(formatYen(1234567)).toBe('1,234,567円')
    expect(formatYen(-500)).toBe('-500円')
  })
})
