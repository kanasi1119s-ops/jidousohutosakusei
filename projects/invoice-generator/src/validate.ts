import { isValidDate } from './format'
import type { Invoice } from './types'

export const MAX_AMOUNT = 999_999_999_999

/** 全角英数を半角にし、前後の空白を除去、英字は大文字にする。 */
export function normalizeRegistrationNumber(s: string): string {
  return s.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

function decimalsWithin(n: number, scale: number): boolean {
  return Math.abs(n * scale - Math.round(n * scale)) < 1e-6
}

export interface ChecklistItem {
  label: string
  ok: boolean
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
  isQualified: boolean
  checklist: ChecklistItem[]
}

export function validateInvoice(inv: Invoice, totalsGross?: number): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  inv.items.forEach((it, i) => {
    const n = i + 1
    if (!Number.isFinite(it.quantity) || !Number.isFinite(it.unitPrice)) {
      errors.push(`明細${n}: 数量と単価は数値で入力してください。`)
      return
    }
    if (it.quantity < 0) errors.push(`明細${n}: 数量は0以上で入力してください（値引きは単価をマイナスにします）。`)
    if (!decimalsWithin(it.quantity, 1000)) errors.push(`明細${n}: 数量は小数第3位までです。`)
    if (!decimalsWithin(it.unitPrice, 100)) errors.push(`明細${n}: 単価は小数第2位までです。`)
    if (Math.abs(it.unitPrice) > 999_999_999 || it.quantity > 100_000) {
      errors.push(`明細${n}: 金額または数量が大きすぎます。`)
    }
  })

  if (inv.issuer.registrationNumber.trim() !== '' && !isValidRegistrationNumber(inv.issuer.registrationNumber)) {
    errors.push('登録番号は「T」+数字13桁で入力してください（例: T1234567890123）。')
  }
  if (inv.issueDate !== '' && !isValidDate(inv.issueDate)) errors.push('発行日の形式が正しくありません。')
  if (inv.transactionDate !== '' && !isValidDate(inv.transactionDate)) errors.push('取引日の形式が正しくありません。')
  if (inv.dueDate !== '' && !isValidDate(inv.dueDate)) errors.push('支払期限の形式が正しくありません。')
  if (totalsGross !== undefined && Math.abs(totalsGross) > MAX_AMOUNT) errors.push('合計金額が大きすぎます。')
  if (totalsGross !== undefined && totalsGross < 0) warnings.push('合計金額がマイナスです（値引きが大きすぎないか確認してください）。')

  const hasNamedItem = inv.items.some((it) => it.name.trim() !== '')
  if (inv.items.length > 0 && inv.items.some((it) => it.name.trim() === '')) {
    warnings.push('品名が空の明細があります。')
  }
  const qualifiedNumberOk = isValidRegistrationNumber(inv.issuer.registrationNumber)
  const checklist: ChecklistItem[] = [
    { label: '発行者の氏名または名称と登録番号', ok: inv.issuer.name.trim() !== '' && qualifiedNumberOk },
    { label: '取引年月日', ok: isValidDate(inv.transactionDate) },
    { label: '取引内容（品名）', ok: hasNamedItem },
    { label: '軽減税率の対象品目である旨（※マークを自動付与）', ok: true },
    { label: '税率ごとに区分した対価の額と適用税率', ok: inv.items.length > 0 },
    { label: '税率ごとに区分した消費税額', ok: inv.items.length > 0 },
    { label: '請求先（交付を受ける事業者）の氏名または名称', ok: inv.clientName.trim() !== '' },
  ]
  return { errors, warnings, isQualified: checklist.every((c) => c.ok), checklist }
}
