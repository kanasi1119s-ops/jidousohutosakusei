import type { AppData, Invoice, Issuer, LineItem, Rounding, TaxRate } from './types'

const STORAGE_KEY = 'invoice-generator:data:v1'

export const EMPTY_ISSUER: Issuer = { name: '', registrationNumber: '', address: '', contact: '', bankInfo: '' }

export function emptyData(): AppData {
  return { version: 1, issuer: { ...EMPTY_ISSUER }, invoices: [] }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function parseItem(raw: unknown): LineItem {
  const o = (raw ?? {}) as Record<string, unknown>
  if (typeof o.quantity !== 'number' || typeof o.unitPriceYen !== 'number') {
    throw new Error('明細の数量・単価が数値ではありません。')
  }
  const rate: TaxRate = o.taxRate === 8 ? 8 : 10
  return { name: str(o.name), quantity: o.quantity, unitPriceYen: o.unitPriceYen, taxRate: rate }
}

function parseInvoice(raw: unknown): Invoice {
  const o = (raw ?? {}) as Record<string, unknown>
  if (typeof o.id !== 'string' || !Array.isArray(o.items)) {
    throw new Error('請求書データの形式が不正です。')
  }
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: o.id,
    number: str(o.number),
    issueDate: str(o.issueDate),
    dueDate: str(o.dueDate),
    clientName: str(o.clientName),
    items: o.items.map(parseItem),
    rounding,
    withholding: o.withholding === true,
    notes: str(o.notes),
  }
}

/** JSON文字列（先頭のBOMは除去）から AppData を検証して復元する。不正なら例外。 */
export function parseDataFromJsonText(text: string): AppData {
  const parsed = JSON.parse(text.replace(/^﻿/, '')) as Record<string, unknown>
  if (parsed === null || typeof parsed !== 'object' || parsed.version !== 1 || !Array.isArray(parsed.invoices)) {
    throw new Error('インポートしたファイルの形式が不正です（このサイトで書き出したJSONを選択してください）。')
  }
  const i = (parsed.issuer ?? {}) as Record<string, unknown>
  return {
    version: 1,
    issuer: {
      name: str(i.name),
      registrationNumber: str(i.registrationNumber),
      address: str(i.address),
      contact: str(i.contact),
      bankInfo: str(i.bankInfo),
    },
    invoices: parsed.invoices.map(parseInvoice),
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseDataFromJsonText(raw) : emptyData()
  } catch {
    return emptyData()
  }
}

export function dataToJsonText(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([dataToJsonText(data)], { type: 'application/json;charset=utf-8' })
}
