import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'nisa-tsumitate-simulator:input:v1'
const KEYS: (keyof SimulatorInput)[] = [
  'initialYen',
  'monthlyTsumitateYen',
  'monthlyGrowthYen',
  'annualReturnPct',
  'years',
]

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
    const parsed: unknown = JSON.parse(raw)
    return isInput(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  const clean = text.replace(/^﻿/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルの形式が不正です（JSONとして読めません）。')
  }
  if (!isInput(parsed)) {
    throw new Error('インポートしたファイルの形式が不正です（必要な項目が数値ではありません）。')
  }
  const o = parsed as unknown as Record<string, number>
  const out = {} as Record<string, number>
  for (const k of KEYS) out[k] = o[k]
  return out as unknown as SimulatorInput
}
