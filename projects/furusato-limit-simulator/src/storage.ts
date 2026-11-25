import type { FurusatoInput, SpouseType } from './calc'

const STORAGE_KEY = 'furusato-limit-simulator:input:v1'

export const DEFAULT_INPUT: FurusatoInput = {
  annualSalaryYen: 5_000_000,
  socialInsuranceYen: null,
  otherDeductionsYen: 0,
  spouse: 'none',
  generalDependents: 0,
  specialDependents: 0,
  alreadyDonatedYen: 0,
}

/** 任意の値を検証して FurusatoInput に整形する。不正なら Error を投げる。 */
export function coerceInput(raw: unknown): FurusatoInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('ファイルの形式が不正です（オブジェクトではありません）。')
  }
  const o = raw as Record<string, unknown>
  const num = (key: string): number => {
    const v = o[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`ファイルの形式が不正です（${key} が数値ではありません）。`)
    }
    return v
  }
  const si = o.socialInsuranceYen
  if (si !== null && (typeof si !== 'number' || !Number.isFinite(si))) {
    throw new Error('ファイルの形式が不正です（socialInsuranceYen が数値でも null でもありません）。')
  }
  if (o.spouse !== 'none' && o.spouse !== 'deduction') {
    throw new Error('ファイルの形式が不正です（spouse が none / deduction のいずれでもありません）。')
  }
  return {
    annualSalaryYen: num('annualSalaryYen'),
    socialInsuranceYen: si as number | null,
    otherDeductionsYen: num('otherDeductionsYen'),
    spouse: o.spouse as SpouseType,
    generalDependents: num('generalDependents'),
    specialDependents: num('specialDependents'),
    alreadyDonatedYen: num('alreadyDonatedYen'),
  }
}

export function saveInput(input: FurusatoInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージが使えない環境（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): FurusatoInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return coerceInput(JSON.parse(raw))
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: FurusatoInput): Blob {
  return new Blob([JSON.stringify(input, null, 2) + '\n'], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): FurusatoInput {
  // 先頭のBOMがあれば取り除く
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('ファイルの形式が不正です（JSONとして読み取れません）。')
  }
  return coerceInput(parsed)
}
