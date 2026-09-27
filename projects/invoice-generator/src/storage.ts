import type { Client, Invoice } from './invoice'
import type { NumberingState } from './numbering'

export interface Profile {
  businessName: string
  registrationNumber: string
  address: string
  bankInfo: string
}

export const DEFAULT_PROFILE: Profile = {
  businessName: '',
  registrationNumber: '',
  address: '',
  bankInfo: '',
}

export interface AppData {
  formatVersion: 1
  profile: Profile
  numbering: NumberingState
  clients: Client[]
  invoices: Invoice[]
}

export function appDataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function jsonDownloadFileName(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `invoice-generator-backup-${y}${m}${d}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * インポートするJSONは他端末で書き出されたバックアップファイルであり、
 * 信頼できない入力として構造を検証してから取り込む。
 */
export function parseAppDataFromJsonText(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSONの形式が正しくありません。')
  }
  if (!isRecord(raw) || raw.formatVersion !== 1) {
    throw new Error('対応していないバックアップ形式です。')
  }
  if (!isRecord(raw.profile) || !isRecord(raw.numbering) || !Array.isArray(raw.clients) || !Array.isArray(raw.invoices)) {
    throw new Error('バックアップの内容が不完全です。')
  }
  return raw as unknown as AppData
}
