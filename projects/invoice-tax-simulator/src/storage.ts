import { validateInput, type SimulatorInput } from './calc'

const STORAGE_KEY = 'invoice-tax-simulator:input:v1'

const KEYS: Array<keyof SimulatorInput> = [
  'taxYear',
  'baseSalesYen',
  'registered',
  'sales10Yen',
  'sales8Yen',
  'purchases10Yen',
  'purchases8Yen',
  'exemptPurchasesYen',
  'transitionalRatio',
  'businessType',
]

/** 任意のJSON値を検証し、想定フィールドだけを取り出して返す。不正なら Error */
export function sanitizeInput(value: unknown): SimulatorInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('インポートしたファイルの形式が不正です（オブジェクトではありません）。')
  }
  const obj = value as Record<string, unknown>
  for (const key of KEYS) {
    if (!(key in obj)) {
      throw new Error(`インポートしたファイルの形式が不正です（${key} がありません）。`)
    }
  }
  const input = Object.fromEntries(KEYS.map((k) => [k, obj[k]])) as unknown as SimulatorInput
  const errors = validateInput(input)
  if (errors.length > 0) {
    throw new Error(`インポートしたファイルの内容が不正です: ${errors.join(' ')}`)
  }
  return input
}

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージが使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitizeInput(JSON.parse(raw))
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

/** JSONテキストを解析する。先頭にBOMがあっても読み込めるようにする */
export function parseInputFromJsonText(text: string): SimulatorInput {
  const cleaned = text.replace(/^﻿/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み込めません。')
  }
  return sanitizeInput(parsed)
}
