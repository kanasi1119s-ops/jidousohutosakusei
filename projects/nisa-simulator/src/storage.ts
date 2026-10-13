import type { NisaInput } from './calc'

const KEY = 'nisa-simulator:input:v1'
const FIELDS: (keyof NisaInput)[] = [
  'initialPrincipalYen',
  'monthlyTsumitateYen',
  'annualGrowthYen',
  'annualReturnPct',
  'feePct',
  'years',
]

export function parseInput(text: string): NisaInput {
  const p = JSON.parse(text.replace(/^﻿/, ''))
  if (p === null || typeof p !== 'object') throw new Error('インポートしたファイルの形式が不正です。')
  for (const k of FIELDS) {
    if (typeof p[k] !== 'number' || !Number.isFinite(p[k]))
      throw new Error(`インポートしたファイルの形式が不正です（${k} が数値ではありません）。`)
  }
  const out = {} as NisaInput
  for (const k of FIELDS) out[k] = p[k]
  return out
}

export function saveInput(i: NisaInput): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(i))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadInput(): NisaInput | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseInput(raw) : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(i: NisaInput): Blob {
  return new Blob([JSON.stringify(i, null, 2)], { type: 'application/json;charset=utf-8' })
}
