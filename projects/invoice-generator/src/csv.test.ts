import { describe, expect, it } from 'vitest'
import { buildInvoiceHistoryCsv, csvDownloadFileName } from './csv'
import type { Invoice } from './invoice'

const sample: Invoice = {
  id: '1',
  number: 'INV-2026-0001',
  issueDate: '2026-09-27',
  dueDate: '2026-10-31',
  clientName: '株式会社サンプル,テスト"部',
  clientAddress: '東京都',
  items: [{ name: '設計費', quantity: 1, unitPriceYen: 100000, taxRate: 10 }],
  notes: '',
  createdAt: 0,
}

describe('buildInvoiceHistoryCsv', () => {
  it('先頭にBOMを付与する（Excelでの文字化け対策）', () => {
    const csv = buildInvoiceHistoryCsv([sample])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('ヘッダー行と集計値を含む', () => {
    const csv = buildInvoiceHistoryCsv([sample])
    expect(csv).toContain('請求書番号,発行日,取引先,小計（税抜）,消費税額,合計（税込）')
    expect(csv).toContain('INV-2026-0001')
    expect(csv).toContain('110000') // 合計（税込）
  })

  it('カンマ・二重引用符を含むフィールドはダブルクオートでエスケープする', () => {
    const csv = buildInvoiceHistoryCsv([sample])
    expect(csv).toContain('"株式会社サンプル,テスト""部"')
  })

  it('改行はCRLFを使う', () => {
    const csv = buildInvoiceHistoryCsv([sample, { ...sample, id: '2', number: 'INV-2026-0002' }])
    expect(csv).toContain('\r\n')
  })
})

describe('csvDownloadFileName', () => {
  it('英数字のみのファイル名を生成する（日本語ファイル名によるZIP展開時の文字化け回避）', () => {
    const name = csvDownloadFileName()
    expect(name).toMatch(/^invoice-history-\d{8}\.csv$/)
  })
})
