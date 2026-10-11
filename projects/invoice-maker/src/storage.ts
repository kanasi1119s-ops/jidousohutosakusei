import { defaultAppData, parseAppData, appDataToJson, type AppData } from './invoice'

const STORAGE_KEY = 'invoice-maker:data:v1'

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, appDataToJson(data))
    return true
  } catch {
    // ストレージが使用不可（プライベートモード・容量超過等）でも画面は動かし続ける
    return false
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return parseAppData(raw)
  } catch {
    // 壊れたデータは無視して初期状態から始める
  }
  return defaultAppData()
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([appDataToJson(data)], { type: 'application/json;charset=utf-8' })
}
