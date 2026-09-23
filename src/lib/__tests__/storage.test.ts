import { beforeEach, describe, expect, it } from 'vitest'
import { simulate } from '../calc'
import {
  clearAllRecords,
  exportAsCsv,
  exportAsJson,
  importFromJson,
  listRecords,
  saveRecord,
} from '../storage'
import { FAMILY_TYPE_LABELS } from '../calc'

beforeEach(() => {
  localStorage.clear()
})

describe('storage round-trip', () => {
  it('saves and lists records', () => {
    const result = simulate({ annualIncome: 5000000, familyType: 'single' })
    saveRecord({ annualIncome: 5000000, familyType: 'single', result, memo: 'テスト' })
    const records = listRecords()
    expect(records).toHaveLength(1)
    expect(records[0].memo).toBe('テスト')
  })

  it('exports and re-imports via JSON without data loss (export -> clear -> import round trip)', () => {
    const result = simulate({ annualIncome: 4000000, familyType: 'spouse_no_income' })
    saveRecord({ annualIncome: 4000000, familyType: 'spouse_no_income', result, memo: '往復テスト' })

    const json = exportAsJson()
    clearAllRecords()
    expect(listRecords()).toHaveLength(0)

    const imported = importFromJson(json)
    expect(imported).toBe(1)
    const records = listRecords()
    expect(records).toHaveLength(1)
    expect(records[0].memo).toBe('往復テスト')
  })

  it('strips a leading BOM before parsing on import', () => {
    const result = simulate({ annualIncome: 4000000, familyType: 'single' })
    saveRecord({ annualIncome: 4000000, familyType: 'single', result, memo: 'BOMテスト' })
    const jsonWithBom = '﻿' + exportAsJson()
    clearAllRecords()
    const imported = importFromJson(jsonWithBom)
    expect(imported).toBe(1)
  })

  it('produces CSV with a BOM prefix and correctly escaped Japanese text', () => {
    const result = simulate({ annualIncome: 5000000, familyType: 'single' })
    saveRecord({
      annualIncome: 5000000,
      familyType: 'single',
      result,
      memo: 'カンマ,を含む"メモ"',
    })
    const csv = exportAsCsv(listRecords(), FAMILY_TYPE_LABELS)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('独身、または配偶者に収入がある夫婦')
    expect(csv).toContain('"カンマ,を含む""メモ"""')
  })

  it('rejects invalid JSON on import instead of silently corrupting storage', () => {
    saveRecord({
      annualIncome: 3000000,
      familyType: 'single',
      result: simulate({ annualIncome: 3000000, familyType: 'single' }),
      memo: '既存データ',
    })
    expect(() => importFromJson('{ this is not valid json')).toThrow()
    // 既存データが壊れていないこと
    expect(listRecords()).toHaveLength(1)
  })

  it('does not duplicate records when importing the same export twice (double operation)', () => {
    saveRecord({
      annualIncome: 3000000,
      familyType: 'single',
      result: simulate({ annualIncome: 3000000, familyType: 'single' }),
      memo: '重複防止テスト',
    })
    const json = exportAsJson()
    importFromJson(json)
    importFromJson(json)
    expect(listRecords()).toHaveLength(1)
  })
})
