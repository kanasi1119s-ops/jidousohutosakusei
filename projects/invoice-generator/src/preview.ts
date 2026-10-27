import { calcInvoice, type InvoiceTotals } from './calc'
import { h } from './dom'
import { formatDateJa, formatNumber, formatYen } from './format'
import type { Invoice } from './types'
import { isValidRegistrationNumber, normalizeRegistrationNumber } from './validate'

function td(text: string, cls = ''): HTMLTableCellElement {
  return h('td', cls ? { class: cls } : {}, text)
}

export function renderPreview(inv: Invoice, totals: InvoiceTotals = calcInvoice(inv)): HTMLElement {
  const qualified = isValidRegistrationNumber(inv.issuer.registrationNumber)
  const priceLabel = inv.priceMode === 'exclusive' ? '税抜' : '税込'
  const hasReduced = inv.items.some((it) => it.taxRate === 8)

  const rows = inv.items.map((it, i) =>
    h(
      'tr',
      {},
      td((it.name || '（品名未入力）') + (it.taxRate === 8 ? ' ※' : '')),
      td(formatNumber(it.quantity), 'num'),
      td(formatNumber(it.unitPrice), 'num'),
      td(it.taxRate === 0 ? '非課税等' : `${it.taxRate}%`, 'num'),
      td(formatYen(totals.lines[i]), 'num'),
    ),
  )

  const summaryRows: HTMLElement[] = []
  for (const r of totals.byRate) {
    const rateName = r.rate === 0 ? '非課税・不課税等' : `${r.rate}%対象`
    summaryRows.push(
      h('tr', {}, td(`${rateName} 対価の額（税抜）`), td(formatYen(r.net), 'num')),
    )
    if (r.rate !== 0) summaryRows.push(h('tr', {}, td(`${rateName} 消費税額`), td(formatYen(r.tax), 'num')))
  }
  summaryRows.push(h('tr', { class: 'total' }, td('合計（税込）'), td(formatYen(totals.gross), 'num')))
  if (inv.withholdingEnabled) {
    summaryRows.push(h('tr', {}, td('源泉徴収税額（復興特別所得税を含む）'), td('-' + formatYen(totals.withholding), 'num')))
    summaryRows.push(h('tr', { class: 'total' }, td('ご請求金額'), td(formatYen(totals.payable), 'num')))
  }

  const issuerLines = [
    inv.issuer.name,
    inv.issuer.registrationNumber ? `登録番号: ${normalizeRegistrationNumber(inv.issuer.registrationNumber)}` : '',
    inv.issuer.postalCode ? `〒${inv.issuer.postalCode}` : '',
    inv.issuer.address,
    inv.issuer.phone ? `TEL: ${inv.issuer.phone}` : '',
    inv.issuer.email,
  ].filter((s) => s !== '')

  return h(
    'article',
    { class: 'invoice', id: 'invoice-preview', 'aria-label': '請求書プレビュー' },
    h('h2', { class: 'invoice-title' }, qualified ? '請求書（適格請求書）' : '請求書'),
    h(
      'div',
      { class: 'invoice-head' },
      h(
        'div',
        { class: 'client' },
        h('p', { class: 'client-name' }, `${inv.clientName || '（請求先未入力）'} ${inv.honorific}`),
        inv.subject ? h('p', {}, `件名: ${inv.subject}`) : null,
        h('p', { class: 'invoice-total-line' }, `ご請求金額: ${formatYen(totals.payable)}${inv.withholdingEnabled ? "（税込・源泉徴収後）" : "（税込）"}`),
      ),
      h(
        'div',
        { class: 'meta' },
        inv.invoiceNumber ? h('p', {}, `請求書番号: ${inv.invoiceNumber}`) : null,
        inv.issueDate ? h('p', {}, `発行日: ${formatDateJa(inv.issueDate)}`) : null,
        inv.transactionDate ? h('p', {}, `取引日: ${formatDateJa(inv.transactionDate)}`) : null,
        inv.dueDate ? h('p', {}, `お支払期限: ${formatDateJa(inv.dueDate)}`) : null,
        ...issuerLines.map((l, i) => h('p', { class: i === 0 ? 'issuer-name' : '' }, l)),
      ),
    ),
    h(
      'table',
      { class: 'items' },
      h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', { class: 'num' }, '数量'), h('th', { class: 'num' }, '単価'), h('th', { class: 'num' }, '税率'), h('th', { class: 'num' }, `金額（${priceLabel}）`))),
      h('tbody', {}, ...rows),
    ),
    hasReduced ? h('p', { class: 'note-small' }, '※ は軽減税率（8%）対象品目です。') : null,
    h('table', { class: 'summary' }, h('tbody', {}, ...summaryRows)),
    inv.issuer.bankInfo ? h('div', { class: 'block' }, h('h3', {}, 'お振込先'), h('p', { class: 'pre' }, inv.issuer.bankInfo)) : null,
    inv.notes ? h('div', { class: 'block' }, h('h3', {}, '備考'), h('p', { class: 'pre' }, inv.notes)) : null,
  )
}
