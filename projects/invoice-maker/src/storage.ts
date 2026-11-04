import { emptyData, parseDataFromJsonText, type AppData } from './model'

const STORAGE_KEY = 'invoice-maker:data:v1'

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    return parseDataFromJsonText(raw)
  } catch {
    return emptyData()
  }
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}
