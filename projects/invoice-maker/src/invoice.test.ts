import { describe, expect, it } from 'vitest'
import { buildInvoiceListCsv, csvFileName, neutralizeFormula, stripBom } from './csv'
import {
  appDataToJson,
  checkRequirements,
  defaultAppData,
  newInvoice,
  parseAppData,
  suggestInvoiceNumber,
} from './invoice'

describe('CSV', () => {
  it('先頭がBOMで、日本語ヘッダーを含む', () => {
    const csv = buildInvoiceListCsv([newInvoice([])])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(stripBom(csv).startsWith('請求書番号')).toBe(true)
  })
  it('カンマ・改行・引用符を含む値をエスケープする', () => {
    const inv = newInvoice([])
    inv.recipient = '株式会社"A", B\n支店'
    const csv = buildInvoiceListCsv([inv])
    expect(csv).toContain('"株式会社""A"", B\n支店"')
  })
  it('数式として解釈される先頭文字を無害化する', () => {
    expect(neutralizeFormula('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(neutralizeFormula('@cmd')).toBe("'@cmd")
    expect(neutralizeFormula('通常')).toBe('通常')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName(new Date(2026, 9, 11))).toBe('invoice-list-2026-10-11.csv')
  })
})

describe('invoice number', () => {
  it('連番を提案し、重複しない', () => {
    const a = newInvoice([], new Date(2026, 9, 11))
    expect(a.number).toBe('INV-202610-001')
    const b = newInvoice([a], new Date(2026, 9, 12))
    expect(b.number).toBe('INV-202610-002')
    a.number = 'INV-202610-002'
    expect(suggestInvoiceNumber([a], new Date(2026, 9, 12))).toBe('INV-202610-003')
  })
  it('支払期限は翌月末', () => {
    expect(newInvoice([], new Date(2026, 9, 11)).dueDate).toBe('2026-11-30')
  })
})

describe('JSON import', () => {
  it('エクスポート→インポートの往復で内容が保たれる', () => {
    const d = defaultAppData()
    d.issuer.name = '山田 太郎（日本語）'
    d.invoices[0].lines[0].name = '制作費'
    const back = parseAppData(appDataToJson(d))
    expect(back.issuer.name).toBe('山田 太郎（日本語）')
    expect(back.invoices[0].lines[0].name).toBe('制作費')
    expect(back.currentId).toBe(d.currentId)
  })
  it('不正な形式は例外', () => {
    expect(() => parseAppData('[]')).toThrow()
    expect(() => parseAppData('{"version":2}')).toThrow()
    expect(() => parseAppData('{"version":1,"invoices":"x"}')).toThrow()
    expect(() => parseAppData('not json')).toThrow()
  })
  it('不正な値は安全な値に矯正される', () => {
    const back = parseAppData(
      JSON.stringify({
        version: 1,
        issuer: { name: 5 },
        invoices: [{ id: 'a', lines: [{ name: 1, quantity: 'x', unitPrice: 1e99, taxRate: 3 }], priceMode: 'zzz' }],
      }),
    )
    const inv = back.invoices[0]
    expect(back.issuer.name).toBe('')
    expect(inv.lines[0].unitPrice).toBe(1e8)
    expect(inv.lines[0].taxRate).toBe(10)
    expect(inv.priceMode).toBe('exclusive')
  })
  it('重複IDは振り直される', () => {
    const back = parseAppData(
      JSON.stringify({ version: 1, invoices: [{ id: 'a' }, { id: 'a' }] }),
    )
    expect(back.invoices[0].id).not.toBe(back.invoices[1].id)
  })
})

describe('記載事項チェック', () => {
  it('未入力は要確認、入力済みはOK', () => {
    const d = defaultAppData()
    const before = checkRequirements(d.issuer, d.invoices[0])
    expect(before.filter((c) => !c.ok).length).toBeGreaterThanOrEqual(4)
    d.issuer.name = 'A'
    d.issuer.registrationNumber = 'T1234567890123'
    d.invoices[0].recipient = 'B'
    d.invoices[0].lines[0].name = '品'
    const after = checkRequirements(d.issuer, d.invoices[0])
    expect(after.every((c) => c.ok)).toBe(true)
  })
})
