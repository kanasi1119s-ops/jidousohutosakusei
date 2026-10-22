import type { InvoiceCalc } from './calc'
import { checkRegistrationNumber } from './registration'
import type { InvoiceDoc, IssuerInfo } from './types'

export interface CheckItem {
  id: string
  label: string
  ok: boolean
  detail: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** 適格請求書（インボイス）の記載事項チェック。消費税法57条の4第1項の記載事項に対応 */
export function checkQualifiedInvoice(
  doc: InvoiceDoc,
  issuer: IssuerInfo,
  calc: InvoiceCalc,
): CheckItem[] {
  const reg = checkRegistrationNumber(issuer.registrationNumber)
  const filled = doc.items.filter((_, i) => calc.lines[i]?.status !== 'empty')
  const missingDesc = filled.filter((it) => it.description.trim() === '').length
  const okLines = calc.lines.filter((l) => l.status === 'ok').length
  return [
    {
      id: 'issuer-name',
      label: '発行者の氏名または名称',
      ok: issuer.name.trim() !== '',
      detail: issuer.name.trim() !== '' ? '入力済み' : '発行者情報の名称を入力してください',
    },
    {
      id: 'registration',
      label: '登録番号（T＋13桁）',
      ok: reg.valid,
      detail: reg.message,
    },
    {
      id: 'date',
      label: '取引年月日',
      ok: isValidIsoDate(doc.issueDate),
      detail: isValidIsoDate(doc.issueDate) ? '入力済み（発行日を取引年月日として扱います）' : '発行日を入力してください',
    },
    {
      id: 'description',
      label: '取引内容（軽減税率の対象品目はその旨）',
      ok: okLines > 0 && missingDesc === 0,
      detail:
        okLines === 0
          ? '明細を入力してください'
          : missingDesc > 0
            ? `品名が空の明細が${missingDesc}行あります（8%の行には「※」が自動で付きます）`
            : '入力済み（8%の行には「※」が自動で付きます）',
    },
    {
      id: 'rate-amount',
      label: '税率ごとに区分した合計額と適用税率',
      ok: okLines > 0 && calc.errors.length === 0,
      detail: calc.errors.length > 0 ? '明細にエラーがあります' : okLines > 0 ? '税率別内訳を表示します' : '明細を入力してください',
    },
    {
      id: 'tax-amount',
      label: '税率ごとの消費税額（端数処理は税率ごとに1回）',
      ok: okLines > 0 && calc.errors.length === 0,
      detail: okLines > 0 && calc.errors.length === 0 ? '税率ごとに1回だけ端数処理しています' : '明細を確認してください',
    },
    {
      id: 'client-name',
      label: '書類の交付を受ける事業者の氏名または名称',
      ok: doc.clientName.trim() !== '',
      detail: doc.clientName.trim() !== '' ? '入力済み' : '宛名を入力してください（小売業等の簡易インボイスでは省略可）',
    },
  ]
}
