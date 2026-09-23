import type { FamilyType, SimulationResult } from './calc'

const STORAGE_KEY = 'furusato-sim.v1'

export interface SavedRecord {
  id: string
  savedAt: string
  annualIncome: number
  familyType: FamilyType
  result: SimulationResult
  memo: string
}

export interface StoredState {
  records: SavedRecord[]
}

function readRaw(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { records: [] }
    const parsed = JSON.parse(raw) as StoredState
    if (!Array.isArray(parsed.records)) return { records: [] }
    return parsed
  } catch {
    return { records: [] }
  }
}

function writeRaw(state: StoredState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function listRecords(): SavedRecord[] {
  return readRaw().records.slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function saveRecord(record: Omit<SavedRecord, 'id' | 'savedAt'>): SavedRecord {
  const state = readRaw()
  const full: SavedRecord = {
    ...record,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  }
  state.records.push(full)
  writeRaw(state)
  return full
}

export function deleteRecord(id: string): void {
  const state = readRaw()
  state.records = state.records.filter((r) => r.id !== id)
  writeRaw(state)
}

export function clearAllRecords(): void {
  writeRaw({ records: [] })
}

export function exportAsJson(): string {
  return JSON.stringify(readRaw(), null, 2)
}

/**
 * インポート時は先頭のBOM(U+FEFF)を除去してから解析する。
 * 他のツールが出力したBOM付きUTF-8ファイルを読み込んでも文字化けさせないため。
 */
export function importFromJson(text: string): number {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const parsed = JSON.parse(stripped) as StoredState
  if (!Array.isArray(parsed.records)) throw new Error('invalid format')
  const state = readRaw()
  const existingIds = new Set(state.records.map((r) => r.id))
  let imported = 0
  for (const rec of parsed.records) {
    if (!existingIds.has(rec.id)) {
      state.records.push(rec)
      existingIds.add(rec.id)
      imported += 1
    }
  }
  writeRaw(state)
  return imported
}

const CSV_HEADER = ['保存日時', '年収(円)', '家族構成', '控除上限額(円)', 'メモ']

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** CSVはExcelで開いても文字化けしないよう先頭にBOMを付けたUTF-8文字列として返す */
export function exportAsCsv(records: SavedRecord[], familyLabels: Record<FamilyType, string>): string {
  const rows = [CSV_HEADER]
  for (const r of records) {
    rows.push([
      r.savedAt,
      String(r.annualIncome),
      familyLabels[r.familyType],
      String(r.result.donationLimit),
      r.memo,
    ])
  }
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
  return '﻿' + body
}
