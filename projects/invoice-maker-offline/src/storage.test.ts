import { describe, expect, it } from 'vitest'
import { loadAppData, parseImportedJson, sanitizeAppData, saveAppData, serializeAppData, STORAGE_KEY } from './storage'
import { emptyDoc, emptyIssuer } from './types'

describe('保存・読み込み', () => {
  it('シリアライズ→取り込みの往復で内容が保たれる（BOM付きでも可）', () => {
    const doc = emptyDoc()
    doc.clientName = '株式会社テスト'
    const json = serializeAppData({ version: 1, issuer: { ...emptyIssuer(), name: '山田太郎' }, docs: [doc], draft: null })
    for (const text of [json, '﻿' + json]) {
      const parsed = parseImportedJson(text)
      expect(parsed?.issuer.name).toBe('山田太郎')
      expect(parsed?.docs[0].clientName).toBe('株式会社テスト')
    }
  })
  it('不正なJSON・バージョン違いは null', () => {
    expect(parseImportedJson('not json')).toBeNull()
    expect(parseImportedJson('{"version":2}')).toBeNull()
    expect(parseImportedJson('[]')).toBeNull()
  })
  it('不正な型や巨大な値を安全な値に丸める', () => {
    const d = sanitizeAppData({
      version: 1,
      issuer: { name: 123 },
      docs: [{ id: '<img src=x>', items: 'x' }, { id: 'ok1', docType: 'zzz', rounding: 'zzz', clientName: 'x'.repeat(5000), items: [{ taxRate: 99 }] }],
    })
    expect(d?.issuer.name).toBe('')
    expect(d?.docs).toHaveLength(2)
    expect(d?.docs[0].id).toBe('imgsrcx')
    expect(d?.docs[1].docType).toBe('invoice')
    expect(d?.docs[1].rounding).toBe('floor')
    expect(d?.docs[1].clientName).toHaveLength(200)
    expect(d?.docs[1].items[0].taxRate).toBe(10)
  })
  it('idが空になるドキュメントは捨てる', () => {
    expect(sanitizeAppData({ version: 1, docs: [{ id: '!!!' }] })?.docs).toHaveLength(0)
  })
  it('storage の保存と復元、壊れたデータはフォールバック', () => {
    const mem: Record<string, string> = {}
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) }
    const data = { version: 1 as const, issuer: { ...emptyIssuer(), name: 'A' }, docs: [], draft: null }
    expect(saveAppData(st, data)).toBe(true)
    expect(loadAppData(st).issuer.name).toBe('A')
    mem[STORAGE_KEY] = '{broken'
    expect(loadAppData(st).docs).toEqual([])
    expect(saveAppData(null, data)).toBe(false)
  })
})
