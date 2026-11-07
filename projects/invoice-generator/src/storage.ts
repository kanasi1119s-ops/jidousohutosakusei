import { sanitizeInvoice, type Invoice } from './model'

const KEY = 'invoice-generator:v1'

export function loadInvoice(today: string): Invoice | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return sanitizeInvoice(JSON.parse(raw), today)
  } catch {
    return null
  }
}

export function saveInvoice(inv: Invoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(inv))
  } catch {
    // 保存不可の環境(プライベートモード等)でも動作は継続する
  }
}

export function invoiceToJson(inv: Invoice): string {
  return JSON.stringify(inv, null, 2) + '\n'
}

export function parseInvoiceJson(text: string, today: string): Invoice | null {
  try {
    return sanitizeInvoice(JSON.parse(text.replace(/^﻿/, '')), today)
  } catch {
    return null
  }
}
