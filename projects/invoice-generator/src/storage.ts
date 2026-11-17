import { sanitizeInvoice, type Invoice } from './model'

const KEY = 'invoice-generator:v1'

export function loadAll(): Invoice[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
  } catch {
    return []
  }
}

export function saveAll(list: Invoice[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function upsert(list: Invoice[], inv: Invoice): Invoice[] {
  const i = list.findIndex((x) => x.id === inv.id)
  if (i < 0) return [inv, ...list]
  const copy = list.slice()
  copy[i] = inv
  return copy
}

export function exportJson(list: Invoice[]): Blob {
  return new Blob([JSON.stringify({ app: 'invoice-generator', version: 1, invoices: list }, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
}

export function parseImport(text: string): Invoice[] | null {
  try {
    const clean = text.replace(/^﻿/, '')
    const data = JSON.parse(clean)
    const arr = Array.isArray(data?.invoices) ? data.invoices : null
    if (!arr || arr.length > 1000) return null
    const out = arr.map(sanitizeInvoice)
    if (out.some((x: Invoice | null) => x === null)) return null
    return out as Invoice[]
  } catch {
    return null
  }
}
