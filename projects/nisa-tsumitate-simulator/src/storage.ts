import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'nisa-tsumitate-simulator:input:v1'
const KEYS: (keyof SimulatorInput)[] = ['initialYen', 'tsumitateMonthlyYen', 'growthMonthlyYen', 'annualReturnPercent', 'years']

function isInput(v: unknown): v is SimulatorInput {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return KEYS.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k] as number))
}

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return isInput(p) ? p : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  const clean = text.replace(/^﻿/, '')
  let p: unknown
  try {
    p = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読めません。')
  }
  if (!isInput(p)) throw new Error('インポートしたファイルの形式が不正です（必要な項目が数値ではありません）。')
  const o = p as unknown as Record<string, number>
  return Object.fromEntries(KEYS.map((k) => [k, o[k]])) as unknown as SimulatorInput
}
