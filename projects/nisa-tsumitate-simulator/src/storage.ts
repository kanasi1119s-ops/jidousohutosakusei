import type { SimInput } from './calc'

const KEY = 'nisa-tsumitate-simulator:input:v1'

export function parseInputFromJsonText(text: string): SimInput {
  const p = JSON.parse(text.replace(/^﻿/, ''))
  if (p === null || typeof p !== 'object') throw new Error('インポートしたファイルの形式が不正です。')
  if (p.account !== 'adult' && p.account !== 'child') throw new Error('インポートしたファイルの形式が不正です（account）。')
  for (const k of ['initialYen', 'monthlyTsumitateYen', 'monthlyGrowthYen', 'annualReturnPct', 'years']) {
    if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) throw new Error(`インポートしたファイルの形式が不正です（${k} が数値ではありません）。`)
  }
  return {
    account: p.account,
    initialYen: p.initialYen,
    monthlyTsumitateYen: p.monthlyTsumitateYen,
    monthlyGrowthYen: p.monthlyGrowthYen,
    annualReturnPct: p.annualReturnPct,
    years: p.years,
  }
}

export function saveInput(i: SimInput): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(i))
  } catch {
    // ストレージ使用不可でも継続
  }
}

export function loadInput(): SimInput | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseInputFromJsonText(raw) : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(i: SimInput): Blob {
  return new Blob([JSON.stringify(i, null, 2)], { type: 'application/json;charset=utf-8' })
}
