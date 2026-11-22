import { describe, expect, it } from 'vitest'
import { buildInvoicesCsv, csvFileName, escapeCsvField, jsonFileName } from './csv'
import { newInvoice, parseAppData, emptyData } from './model'

describe('CSV', () => {
  it('先頭にBOMが付き、日本語ヘッダーを含む', () => {
    const csv = buildInvoicesCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
  })
  it('カンマ・引用符・改行をエスケープする', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('a"b')).toBe('"a""b"')
    expect(escapeCsvField('a\nb')).toBe('"a\nb"')
  })
  it('数式として解釈される先頭文字を無効化する', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1")
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)")
  })
  it('請求書の金額が行に出力される', () => {
    const inv = newInvoice(1, new Date(2026, 10, 22))
    inv.clientName = '株式会社テスト'
    inv.lines = [{ name: 'x', qty: 1, unitPrice: 1000, rate: 10 }]
    const csv = buildInvoicesCsv([inv])
    expect(csv).toContain('INV-2026-0001,2026-11-22,,株式会社テスト,,1000,100,1100,0,1100')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName(new Date(2026, 10, 22))).toBe('invoices-2026-11-22.csv')
    expect(jsonFileName(new Date(2026, 10, 22))).toBe('invoice-generator-backup-2026-11-22.json')
  })
})

describe('parseAppData', () => {
  it('往復できる', () => {
    const d = emptyData()
    d.issuer.name = '山田太郎（デザイン）'
    d.invoices.push(newInvoice(1))
    const back = parseAppData(JSON.stringify(d))
    expect(back?.issuer.name).toBe('山田太郎（デザイン）')
    expect(back?.invoices).toHaveLength(1)
  })
  it('BOM付きでも読める', () => {
    expect(parseAppData('﻿' + JSON.stringify(emptyData()))).not.toBeNull()
  })
  it('不正な入力は null', () => {
    expect(parseAppData('not json')).toBeNull()
    expect(parseAppData('[]')).toBeNull()
    expect(parseAppData('{"version":2,"invoices":[]}')).toBeNull()
    expect(parseAppData('{"version":1}')).toBeNull()
  })
  it('壊れた明細は安全な値に補正する', () => {
    const d = parseAppData(
      JSON.stringify({ version: 1, invoices: [{ id: 'a', lines: [{ name: 5, qty: 'x', unitPrice: null, rate: 3 }] }] }),
    )
    expect(d?.invoices[0].lines[0]).toEqual({ name: '', qty: 1, unitPrice: 0, rate: 10 })
  })
})
