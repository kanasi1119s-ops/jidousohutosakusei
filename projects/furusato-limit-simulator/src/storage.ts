import type { FurusatoInput } from './calc'

const STORAGE_KEY = 'furusato-limit-simulator:input:v1'

export const DEFAULT_INPUT: FurusatoInput = {
  salaryYen: 5_000_000,
  socialInsuranceYen: null,
  idecoYen: 0,
  otherDeductionYen: 0,
  hasSpouse: false,
  dependentsGeneral: 0,
  dependentsSpecific: 0,
  alreadyDonatedYen: 0,
}

export function validateShape(parsed: unknown): FurusatoInput {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const o = parsed as Record<string, unknown>
  const numKeys = [
    'salaryYen',
    'idecoYen',
    'otherDeductionYen',
    'dependentsGeneral',
    'dependentsSpecific',
    'alreadyDonatedYen',
  ]
  for (const k of numKeys) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k] as number)) {
      throw new Error(`インポートしたファイルの形式が不正です（${k} が数値ではありません）。`)
    }
  }
  if (o.socialInsuranceYen !== null && (typeof o.socialInsuranceYen !== 'number' || !Number.isFinite(o.socialInsuranceYen))) {
    throw new Error('インポートしたファイルの形式が不正です（socialInsuranceYen が数値でもnullでもありません）。')
  }
  if (typeof o.hasSpouse !== 'boolean') {
    throw new Error('インポートしたファイルの形式が不正です（hasSpouse が真偽値ではありません）。')
  }
  return {
    salaryYen: o.salaryYen as number,
    socialInsuranceYen: o.socialInsuranceYen as number | null,
    idecoYen: o.idecoYen as number,
    otherDeductionYen: o.otherDeductionYen as number,
    hasSpouse: o.hasSpouse,
    dependentsGeneral: o.dependentsGeneral as number,
    dependentsSpecific: o.dependentsSpecific as number,
    alreadyDonatedYen: o.alreadyDonatedYen as number,
  }
}

export function saveInput(input: FurusatoInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadInput(): FurusatoInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateShape(JSON.parse(raw))
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: FurusatoInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): FurusatoInput {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み込めません。')
  }
  return validateShape(parsed)
}
