import type { CheckResult, Invoice } from './model'
import { isValidRegistrationNumber } from './util'

/** 適格請求書（インボイス）の記載事項の確認。税率ごとの合計・消費税額は自動計算されるため常に満たす。 */
export function checkInvoice(invoice: Invoice): CheckResult[] {
  const namedItems = invoice.items.every((it) => it.name.trim() !== '')
  return [
    {
      label: '発行者の氏名または名称',
      ok: invoice.issuer.name.trim() !== '',
      hint: '「発行者」欄に入力してください。',
    },
    {
      label: '登録番号（T + 数字13桁）',
      ok: isValidRegistrationNumber(invoice.issuer.registrationNumber),
      hint: '適格請求書発行事業者でない場合は、適格請求書としては扱えません。',
    },
    {
      label: '取引年月日（発行日）',
      ok: invoice.issueDate !== '',
      hint: '発行日を入力してください。',
    },
    {
      label: '取引内容（品名）',
      ok: namedItems,
      hint: '品名が空の明細があります。',
    },
    {
      label: '税率ごとに区分した合計額・適用税率・消費税額',
      ok: invoice.items.length > 0,
    },
    {
      label: '請求先の氏名または名称',
      ok: invoice.clientName.trim() !== '',
      hint: '「請求先」欄に入力してください。',
    },
  ]
}
