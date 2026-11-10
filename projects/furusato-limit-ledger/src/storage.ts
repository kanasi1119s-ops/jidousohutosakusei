import type { LimitInput } from './calc'
import type { Donation } from './ledger'
import { isValidDate } from './ledger'

const KEY = 'furusato-limit-ledger:state:v1'

export interface AppState {
  version: 1
  year: number
  input: LimitInput
  donations: Donation[]
}

export function defaultState(year: number): AppState {
  return {
    version: 1,
    year,
    input: { salaryYen: 5_000_000, socialInsuranceYen: null, spouse: 'none', generalDependents: 0, specialDependents: 0, otherDeductionYen: 0 },
    donations: [],
  }
}

export function validateState(p: unknown): AppState {
  const o = p as Partial<AppState> | null
  if (!o || typeof o !== 'object' || o.version !== 1) throw new Error('ファイルの形式が不正です（version が一致しません）。')
  const i = o.input as LimitInput | undefined
  if (!i || typeof i.salaryYen !== 'number' || typeof i.generalDependents !== 'number' || typeof i.specialDependents !== 'number' ||
      typeof i.otherDeductionYen !== 'number' || (i.socialInsuranceYen !== null && typeof i.socialInsuranceYen !== 'number') ||
      (i.spouse !== 'none' && i.spouse !== 'deduction')) {
    throw new Error('ファイルの形式が不正です（入力項目が不正です）。')
  }
  if (typeof o.year !== 'number' || !Number.isInteger(o.year)) throw new Error('ファイルの形式が不正です（year が不正です）。')
  if (!Array.isArray(o.donations)) throw new Error('ファイルの形式が不正です（donations が配列ではありません）。')
  for (const d of o.donations as Donation[]) {
    if (typeof d.id !== 'string' || !isValidDate(d.date) || typeof d.municipality !== 'string' ||
        !Number.isInteger(d.amountYen) || d.amountYen <= 0 || (d.method !== 'onestop' && d.method !== 'kakutei') || typeof d.sent !== 'boolean') {
      throw new Error('ファイルの形式が不正です（寄付データが不正です）。')
    }
  }
  return o as AppState
}

export function saveState(s: AppState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ストレージ不可でも継続 */ }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? validateState(JSON.parse(raw)) : null
  } catch { return null }
}

export function stateToJsonBlob(s: AppState): Blob {
  return new Blob([JSON.stringify(s, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseStateJson(text: string): AppState {
  return validateState(JSON.parse(text.replace(/^﻿/, '')))
}
