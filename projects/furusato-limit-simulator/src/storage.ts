import type { LimitInput } from './calc'
import { validateDonation, type Donation } from './donations'

const KEY = 'furusato-limit-simulator:data:v1'

export interface AppData {
  version: 1
  input: LimitInput
  donations: Donation[]
}

export const DEFAULT_INPUT: LimitInput = {
  salaryYen: 5_000_000,
  useActualSocialInsurance: false,
  socialInsuranceYen: 0,
  spouse: 'none',
  dependentsGeneral: 0,
  dependentsSpecific: 0,
  dependentsElderly: 0,
  otherDeductionsYen: 0,
  housingLoanResidentCreditYen: 0,
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 外部（localStorage / インポートファイル）由来のデータを検証して AppData に整形する。不正なら例外 */
export function parseAppData(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) throw new Error('インポートしたファイルの形式が不正です。')
  const r = raw as Record<string, unknown>
  const i = r.input as Record<string, unknown> | undefined
  if (!i || typeof i !== 'object') throw new Error('インポートしたファイルの形式が不正です（input がありません）。')
  const numKeys = [
    'salaryYen',
    'socialInsuranceYen',
    'dependentsGeneral',
    'dependentsSpecific',
    'dependentsElderly',
    'otherDeductionsYen',
    'housingLoanResidentCreditYen',
  ] as const
  for (const k of numKeys) {
    if (!isNum(i[k])) throw new Error(`インポートしたファイルの形式が不正です（${k} が数値ではありません）。`)
  }
  if (typeof i.useActualSocialInsurance !== 'boolean') {
    throw new Error('インポートしたファイルの形式が不正です（useActualSocialInsurance）。')
  }
  if (i.spouse !== 'none' && i.spouse !== 'general' && i.spouse !== 'elderly') {
    throw new Error('インポートしたファイルの形式が不正です（spouse）。')
  }
  const list = Array.isArray(r.donations) ? r.donations : []
  const donations: Donation[] = list.map((d, idx) => {
    const o = d as Record<string, unknown>
    if (
      typeof o?.date !== 'string' ||
      typeof o.municipality !== 'string' ||
      !isNum(o.amountYen) ||
      typeof o.oneStopSent !== 'boolean'
    ) {
      throw new Error(`インポートしたファイルの形式が不正です（donations[${idx}]）。`)
    }
    const item: Donation = {
      id: typeof o.id === 'string' ? o.id : `imp-${idx}`,
      date: o.date,
      municipality: o.municipality.slice(0, 50),
      amountYen: o.amountYen,
      oneStopSent: o.oneStopSent,
    }
    if (validateDonation(item).length > 0) {
      throw new Error(`インポートしたファイルの寄附データが不正です（${idx + 1}件目）。`)
    }
    return item
  })
  return { version: 1, input: i as unknown as LimitInput, donations }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return parseAppData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}
