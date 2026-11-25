import { describe, it, expect } from 'vitest'
import { calculate } from './calc'
import { DEFAULT_INPUT, parseInputFromJsonText, coerceInput } from './storage'
import { buildResultCsv, csvDownloadFileName } from './csv'

describe('CSV', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含む', () => {
    const csv = buildResultCsv(DEFAULT_INPUT, calculate(DEFAULT_INPUT))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('控除上限額の目安(円)')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvDownloadFileName(new Date(2026, 10, 25))).toBe('furusato-limit-2026-11-25.csv')
  })
})

describe('JSONインポート', () => {
  it('往復できる', () => {
    const text = JSON.stringify(DEFAULT_INPUT)
    expect(parseInputFromJsonText(text)).toEqual(DEFAULT_INPUT)
    expect(parseInputFromJsonText('﻿' + text)).toEqual(DEFAULT_INPUT)
  })
  it('不正な形式を拒否する', () => {
    expect(() => parseInputFromJsonText('{')).toThrow()
    expect(() => parseInputFromJsonText('[]')).toThrow()
    expect(() => coerceInput({ ...DEFAULT_INPUT, spouse: 'x' })).toThrow()
    expect(() => coerceInput({ ...DEFAULT_INPUT, annualSalaryYen: '5' })).toThrow()
  })
})
