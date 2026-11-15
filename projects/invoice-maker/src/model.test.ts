import { describe, expect, it } from 'vitest'
import { buildInvoicesCsv, escapeCsvField, neutralizeFormula } from './csv'
import {
  addDays,
  buildBackupJson,
  defaultSettings,
  formatJaDate,
  mergeData,
  newInvoice,
  parseBackupText,
  sanitizeInvoice,
} from './model'

describe('日付', () => {
  it('addDays は月末・うるう年をまたいでも正しい', () => {
    expect(addDays('2026-11-15', 30)).toBe('2026-12-15')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('bad', 1)).toBe('')
  })
  it('和暦ではなく西暦の日本語表記', () => {
    expect(formatJaDate('2026-01-05')).toBe('2026年1月5日')
  })
})

describe('バックアップ', () => {
  it('往復しても内容が一致する（日本語含む）', () => {
    const inv = newInvoice(defaultSettings(), '2026-11-15')
    inv.clientName = '株式会社テスト商事'
    inv.items = [{ name: '制作費（デザイン）', qty: 1.5, unitPrice: 12345, taxRate: 8 }]
    const data = { settings: { ...defaultSettings(), issuerName: '山田 太郎' }, invoices: [inv] }
    const back = parseBackupText('\uFEFF' + buildBackupJson(data))
    expect(back.invoices[0]).toEqual(inv)
    expect(back.settings.issuerName).toBe('山田 太郎')
  })
  it('不正なファイルは拒否する', () => {
    expect(() => parseBackupText('not json')).toThrow()
    expect(() => parseBackupText('{"app":"other","version":1}')).toThrow()
    expect(() => parseBackupText('{"app":"invoice-maker","version":99}')).toThrow()
  })
  it('不正な値はサニタイズされる', () => {
    const inv = sanitizeInvoice({ id: 'x', items: [{ name: 5, qty: 'a', unitPrice: 1e30, taxRate: 99 }], issueDate: 'zzz', honorific: 'x' })
    expect(inv).not.toBeNull()
    expect(inv!.items[0]).toEqual({ name: '', qty: 1, unitPrice: 0, taxRate: 10 })
    expect(inv!.honorific).toBe('御中')
    expect(sanitizeInvoice({ items: [] })).toBeNull()
  })
  it('mergeData は同じidを上書き、新規を追加', () => {
    const a = newInvoice(defaultSettings(), '2026-01-01')
    const b = { ...a, clientName: '更新後' }
    const c = newInvoice(defaultSettings(), '2026-01-02')
    const m = mergeData({ settings: defaultSettings(), invoices: [a] }, { settings: defaultSettings(), invoices: [b, c] })
    expect(m.invoices).toHaveLength(2)
    expect(m.invoices.find((i) => i.id === a.id)!.clientName).toBe('更新後')
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で始まり、日本語ヘッダーを含む', () => {
    const csv = buildInvoicesCsv([], 'floor')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    const bytes = new TextEncoder().encode(csv)
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })
  it('カンマ・改行・引用符をエスケープ', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })
  it('数式として解釈される先頭文字を無害化する', () => {
    expect(neutralizeFormula('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(neutralizeFormula('@cmd')).toBe("'@cmd")
    expect(neutralizeFormula('-1000')).toBe('-1000')
    expect(neutralizeFormula('-abc')).toBe("'-abc")
    expect(neutralizeFormula('通常の文字')).toBe('通常の文字')
  })
})
