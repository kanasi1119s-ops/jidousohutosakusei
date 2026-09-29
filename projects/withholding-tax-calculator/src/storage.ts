import { CATEGORY_LABELS, TAX_RATES } from './rules'
import { MAX_AMOUNT_YEN } from './rules'
import type { Entry } from './calc'

const STORAGE_KEY = 'withholding-tax-calculator:entries:v1'

function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.id === 'number' &&
    typeof e.label === 'string' &&
    typeof e.category === 'string' &&
    e.category in CATEGORY_LABELS &&
    typeof e.amountYen === 'number' &&
    Number.isInteger(e.amountYen) &&
    e.amountYen > 0 &&
    e.amountYen <= MAX_AMOUNT_YEN &&
    typeof e.taxRatePercent === 'number' &&
    (TAX_RATES as readonly number[]).includes(e.taxRatePercent) &&
    typeof e.taxSeparated === 'boolean'
  )
}

export function saveEntries(entries: Entry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export function entriesToJsonBlob(entries: Entry[]): Blob {
  return new Blob([JSON.stringify({ version: 1, entries }, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseEntriesFromJsonText(text: string): Entry[] {
  const parsed = JSON.parse(text.replace(/^﻿/, ''))
  const list = Array.isArray(parsed) ? parsed : parsed?.entries
  if (!Array.isArray(list) || !list.every(isEntry)) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  return list
}
