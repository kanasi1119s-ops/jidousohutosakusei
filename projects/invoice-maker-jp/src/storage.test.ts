import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDoc } from './invoice'
import {
  backupToBlob,
  buildBackup,
  loadDocuments,
  loadDraft,
  loadIssuer,
  parseBackup,
  sanitizeDoc,
  saveDocuments,
  saveDraft,
  saveIssuer,
} from './storage'

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('保存→読み込みで復元できる', () => {
    const d = emptyDoc()
    d.clientName = '日本語の取引先'
    saveDocuments([d])
    saveDraft(d)
    saveIssuer({ name: '発行者', address: '', contact: '', registrationNumber: 'T1234567890123' })
    expect(loadDocuments()[0].clientName).toBe('日本語の取引先')
    expect(loadDraft()?.clientName).toBe('日本語の取引先')
    expect(loadIssuer().name).toBe('発行者')
  })
  it('壊れたデータは空として扱う', () => {
    localStorage.setItem('invoice-maker-jp:docs:v1', '{broken')
    localStorage.setItem('invoice-maker-jp:draft:v1', '[1,2')
    expect(loadDocuments()).toEqual([])
    expect(loadDraft()).toBeNull()
  })
})

describe('バックアップ', () => {
  it('往復できる（BOM付きJSONも読める）', async () => {
    const d = emptyDoc()
    d.items = [{ name: '品', quantity: 2, unitPriceYen: 300, taxRate: 8 }]
    const blob = backupToBlob(buildBackup({ name: 'A', address: '', contact: '', registrationNumber: '' }, [d]))
    expect(blob.type).toBe('application/json;charset=utf-8')
    const text = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsText(blob)
    })
    const parsed = parseBackup('﻿' + text)
    expect(parsed.documents[0].items[0]).toEqual({ name: '品', quantity: 2, unitPriceYen: 300, taxRate: 8 })
  })
  it('別形式のJSONや壊れたJSONは拒否する', () => {
    expect(() => parseBackup('not json')).toThrow('JSON')
    expect(() => parseBackup('{"app":"other","documents":[]}')).toThrow('バックアップ')
  })
  it('不正な値は安全な値に丸める', () => {
    const d = sanitizeDoc({ kind: 'evil', items: [{ name: 5, quantity: 'x', unitPriceYen: null, taxRate: 99 }], issueDate: '2026-99-99' })
    expect(d.kind).toBe('invoice')
    expect(d.issueDate).toBe('')
    expect(d.items[0]).toEqual({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
  })
})
