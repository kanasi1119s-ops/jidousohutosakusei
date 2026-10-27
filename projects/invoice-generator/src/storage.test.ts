import { describe, expect, it } from 'vitest'
// jsdom の Blob には text() が無いため FileReader で読む
const blobText = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(b, 'utf-8')
  })

import { dataToJsonBlob, emptyAppData, parseDataFromJsonText, sanitizeAppData } from './storage'

describe('storage', () => {
  it('エクスポート→インポートで内容が一致する', async () => {
    const d = emptyAppData()
    d.draft.clientName = '日本語の請求先'
    d.draft.items[0].name = '品名ＡＢＣ'
    const text = await blobText(dataToJsonBlob(d))
    const back = parseDataFromJsonText(text)
    expect(back.draft.clientName).toBe('日本語の請求先')
    expect(back.draft.items[0].name).toBe('品名ＡＢＣ')
  })
  it('BOM付きJSONも読める', async () => {
    const text = '\uFEFF' + (await blobText(dataToJsonBlob(emptyAppData())))
    expect(() => parseDataFromJsonText(text)).not.toThrow()
  })
  it('不正な形式は日本語のエラーで拒否する', () => {
    expect(() => parseDataFromJsonText('not json')).toThrow('JSON')
    expect(() => parseDataFromJsonText('{"version":2}')).toThrow('バックアップ')
    const d = JSON.parse(JSON.stringify(emptyAppData()))
    d.draft.items[0].taxRate = 5
    expect(() => sanitizeAppData(d)).toThrow('taxRate')
    d.draft.items[0].taxRate = 10
    d.draft.items[0].quantity = 'abc'
    expect(() => sanitizeAppData(d)).toThrow('quantity')
  })
  it('NaN（JSONではnull）は0として読み戻す', () => {
    const d = JSON.parse(JSON.stringify(emptyAppData()))
    d.draft.items[0].quantity = null
    expect(sanitizeAppData(d).draft.items[0].quantity).toBe(0)
  })
  it('過長な文字列は切り詰める', () => {
    const d = JSON.parse(JSON.stringify(emptyAppData()))
    d.draft.notes = 'あ'.repeat(5000)
    expect(sanitizeAppData(d).draft.notes.length).toBe(2000)
  })
})
