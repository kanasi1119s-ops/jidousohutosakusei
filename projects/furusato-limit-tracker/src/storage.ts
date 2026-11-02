import type { LimitInput } from './calc'
import { isValidDate, type Donation } from './tracker'

const KEY = 'furusato-limit-tracker:state:v1'

export interface AppState {
  version: 1
  year: number
  input: LimitInput
  donations: Donation[]
}

export function validateState(p: unknown): AppState {
  const o = p as Partial<AppState> | null
  if (!o || typeof o !== 'object' || o.version !== 1) throw new Error('ファイルの形式が不正です（version）。')
  const i = o.input as Partial<LimitInput> | undefined
  if (!i || typeof i.salaryYen !== 'number' || typeof i.socialInsuranceRate !== 'number' || typeof i.hasSpouse !== 'boolean') {
    throw new Error('ファイルの形式が不正です（input）。')
  }
  for (const k of ['generalDependents', 'specificDependents', 'elderlyDependents', 'otherDeductionYen'] as const) {
    if (typeof i[k] !== 'number') throw new Error(`ファイルの形式が不正です（${k}）。`)
  }
  if (i.socialInsuranceYen !== null && typeof i.socialInsuranceYen !== 'number') throw new Error('ファイルの形式が不正です（socialInsuranceYen）。')
  if (typeof o.year !== 'number' || !Array.isArray(o.donations)) throw new Error('ファイルの形式が不正です。')
  for (const d of o.donations as Donation[]) {
    if (
      typeof d.id !== 'string' || typeof d.municipality !== 'string' || typeof d.amountYen !== 'number' ||
      typeof d.oneStop !== 'boolean' || typeof d.date !== 'string' || !isValidDate(d.date)
    ) {
      throw new Error('ファイルの形式が不正です（donations）。')
    }
  }
  return o as AppState
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? validateState(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function stateToJsonBlob(s: AppState): Blob {
  return new Blob([JSON.stringify(s, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseStateFromJsonText(text: string): AppState {
  return validateState(JSON.parse(text.replace(/^﻿/, '')))
}
