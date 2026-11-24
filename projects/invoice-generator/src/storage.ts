import { emptyIssuer, parseAppData, type AppData } from './model'

const KEY = 'invoice-generator:data:v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return parseAppData(raw)
  } catch {
    // 保存データが壊れていても起動できるようにする
  }
  return { version: 1, issuer: emptyIssuer(), invoices: [] }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}
