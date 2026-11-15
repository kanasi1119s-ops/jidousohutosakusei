import { defaultSettings, sanitizeAppData } from './model'
import type { AppData } from './model'

const STORAGE_KEY = 'invoice-maker:data:v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: defaultSettings(), invoices: [] }
    return sanitizeAppData(JSON.parse(raw))
  } catch {
    return { settings: defaultSettings(), invoices: [] }
  }
}

/** 保存に成功したら true。ストレージ不可・容量超過なら false（呼び出し側で利用者に通知する）。 */
export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 何もしない
  }
}
