import { emptyData, parseAppData, type AppData } from './model'

const KEY = 'invoice-generator:data:v1'

export function loadData(): AppData {
  try {
    const text = localStorage.getItem(KEY)
    if (text) {
      const d = parseAppData(text)
      if (d) return d
    }
  } catch {
    // localStorage が使えない環境ではメモリ上のみで動作する
  }
  return emptyData()
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
