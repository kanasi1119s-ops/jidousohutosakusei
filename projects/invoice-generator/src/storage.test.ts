import { describe, it, expect, beforeEach } from 'vitest'
import { loadInvoices, saveInvoices, parseBackupText, sanitizeInvoice, mergeInvoices, loadIssuer, saveIssuer } from './storage'
import { buildInvoicesCsv, sanitizeCsvText, csvDownloadFileName } from './csv'
import { renderInvoiceHtml } from './preview'
import { safeFileToken } from './format'
import type { Invoice } from './invoice'

const sample = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'a1', number: 'INV-202611-001', issueDate: '2026-11-09', dueDate: '', customerName: '株式会社テスト',
  issuer: { name: '山田太郎', registrationNumber: 'T1234567890123', address: '', contact: '', bank: '' },
  items: [{ name: '制作費', quantity: 1, unit: '式', unitPrice: 10000, rate: 10 }],
  priceMode: 'exclusive', rounding: 'floor', note: '', savedAt: '2026-11-09T00:00:00Z', ...over,
})

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('保存→読み込みで日本語が往復する', () => {
    saveInvoices([sample()])
    expect(loadInvoices()[0].customerName).toBe('株式会社テスト')
  })
  it('壊れたデータは空配列', () => {
    localStorage.setItem('invoice-generator:v1:invoices', '{broken')
    expect(loadInvoices()).toEqual([])
  })
  it('発行者情報の保存と復元', () => {
    saveIssuer(sample().issuer)
    expect(loadIssuer().name).toBe('山田太郎')
  })
  it('バックアップのパースと不正データのスキップ', () => {
    const text = JSON.stringify({ app: 'invoice-generator', version: 1, issuer: null, invoices: [sample(), { id: '../x' }, null] })
    const r = parseBackupText('﻿' + text)
    expect(r.invoices).toHaveLength(1)
    expect(r.skipped).toBe(2)
  })
  it('他アプリのJSONは拒否', () => {
    expect(() => parseBackupText('{"app":"other"}')).toThrow()
    expect(() => parseBackupText('xx')).toThrow()
  })
  it('不正な日付・非数値の明細は無害化で拒否', () => {
    expect(sanitizeInvoice({ ...sample(), issueDate: '2026-13-01' })).toBeNull()
    expect(sanitizeInvoice({ ...sample(), items: [{ name: 'a', quantity: 'x', unitPrice: 1 }] })).toBeNull()
  })
  it('mergeは同一idを置換', () => {
    const m = mergeInvoices([sample()], [sample({ customerName: '更新' }), sample({ id: 'b2' })])
    expect(m).toHaveLength(2)
    expect(m.find((i) => i.id === 'a1')?.customerName).toBe('更新')
  })
})

describe('csv', () => {
  it('先頭にBOM、日本語ヘッダー、CRLF', () => {
    const csv = buildInvoicesCsv([sample()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain('\r\n')
    expect(csv).toContain('11000')
  })
  it('数式インジェクション対策', () => {
    expect(sanitizeCsvText('=cmd()')).toBe("'=cmd()")
    expect(sanitizeCsvText('通常')).toBe('通常')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvDownloadFileName(new Date(2026, 10, 9))).toBe('invoices-2026-11-09.csv')
    expect(safeFileToken('請求書 #1/あ')).toBe('1')
    expect(safeFileToken('あ')).toBe('invoice')
  })
})

describe('preview', () => {
  it('HTMLをエスケープする（XSS対策）', () => {
    const html = renderInvoiceHtml(sample({ customerName: '<img src=x onerror=alert(1)>', note: '<script>x</script>' }))
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img')
  })
  it('登録番号・税率別の区分・軽減税率の注記を含む', () => {
    const html = renderInvoiceHtml(sample({ items: [{ name: '食品', quantity: 2, unit: '個', unitPrice: 500, rate: 8 }] }))
    expect(html).toContain('T1234567890123')
    expect(html).toContain('8%対象（軽減税率）')
    expect(html).toContain('※は軽減税率')
  })
})
