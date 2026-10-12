import { describe, expect, it } from 'vitest'
import { calculate } from './calc'
import { buildInvoiceCsv, csvDownloadFileName } from './csv'
import { backupToBlob, buildBackup, newInvoice, parseBackupText, sanitizeInvoice } from './model'
import { checkInvoice } from './checks'

describe('sanitizeInvoice / バックアップ', () => {
  it('往復しても内容が変わらない', () => {
    const inv = newInvoice({ name: '山田デザイン事務所', registrationNumber: 'T1234567890123', address: '', contact: '' })
    inv.items[0] = { id: 'a', name: '制作費', quantity: 1.5, unitPriceYen: 20000, taxRate: 10 }
    const text = JSON.stringify(buildBackup(inv.issuer, [inv]), null, 2)
    expect(backupToBlob(buildBackup(inv.issuer, [inv])).type).toBe('application/json;charset=utf-8')
    const back = parseBackupText(text)
    expect(back.invoices[0].items[0]).toEqual(inv.items[0])
    expect(back.invoices[0].issuer.name).toBe('山田デザイン事務所')
  })
  it('BOM付きのJSONも読める', () => {
    const inv = newInvoice()
    const text = '﻿' + JSON.stringify(buildBackup(inv.issuer, [inv]))
    expect(parseBackupText(text).invoices).toHaveLength(1)
  })
  it('不正なデータを拒否する', () => {
    expect(() => parseBackupText('これはJSONではない')).toThrow()
    expect(() => parseBackupText('{"app":"other","invoices":[]}')).toThrow()
    const inv = newInvoice()
    expect(() => sanitizeInvoice({ ...inv, items: [] })).toThrow()
    expect(() => sanitizeInvoice({ ...inv, items: [{ ...inv.items[0], taxRate: 5 }] })).toThrow()
    expect(() => sanitizeInvoice({ ...inv, items: [{ ...inv.items[0], unitPriceYen: 1.5 }] })).toThrow()
    expect(() => sanitizeInvoice({ ...inv, items: [{ ...inv.items[0], quantity: 1e9 }] })).toThrow()
  })
  it('長すぎる文字列は切り詰める', () => {
    const inv = newInvoice()
    expect(sanitizeInvoice({ ...inv, notes: 'あ'.repeat(5000) }).notes).toHaveLength(1000)
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含み、式インジェクションを無効化する', () => {
    const inv = newInvoice()
    inv.items = [{ id: 'a', name: '=HYPERLINK("x")', quantity: 1, unitPriceYen: 1000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv, calculate(inv.items, inv.options))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量')
    expect(csv).toContain('"\'=HYPERLINK(""x"")"')
    expect(csv).toContain('10%対象,1000,100,1100')
  })
  it('ファイル名は英数字のみ', () => {
    const inv = newInvoice(undefined, 'INV-請求-001')
    expect(csvDownloadFileName(inv)).toBe('invoice-INV-001.csv')
  })
})

describe('適格請求書チェック', () => {
  it('必須項目が揃っていれば全てOK', () => {
    const inv = newInvoice({ name: 'A', registrationNumber: 'T1234567890123', address: '', contact: '' })
    inv.clientName = 'B社'
    inv.items[0].name = '制作費'
    expect(checkInvoice(inv).every((c) => c.ok)).toBe(true)
  })
  it('登録番号の形式不正を検出する', () => {
    const inv = newInvoice({ name: 'A', registrationNumber: '12345', address: '', contact: '' })
    expect(checkInvoice(inv).find((c) => c.label.startsWith('登録番号'))?.ok).toBe(false)
  })
})
