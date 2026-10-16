import { calcInvoice, lineAmount } from './calc'
import type { Invoice, Issuer } from './model'

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function multiline(s: string): string {
  return esc(s).replace(/\r?\n/g, '<br>')
}

export function yen(n: number): string {
  return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('ja-JP')
}

function jpDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function renderInvoiceHtml(inv: Invoice, issuer: Issuer): string {
  const t = calcInvoice(inv)
  const reduced = (rate: number) => (rate === 8 ? '※' : '')
  const rows = inv.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.description)}${reduced(l.taxRate)}</td>
        <td class="num">${esc(String(l.quantity))}</td>
        <td class="num">${yen(l.unitPrice)}</td>
        <td class="num">${l.taxRate === 0 ? '非課税' : l.taxRate + '%'}</td>
        <td class="num">${yen(lineAmount(l, inv.rounding))}</td>
      </tr>`,
    )
    .join('')
  const hasReduced = inv.lines.some((l) => l.taxRate === 8)
  const modeLabel = inv.priceMode === 'inclusive' ? '税込' : '税抜'
  const groupRows = t.groups
    .map(
      (g) => `<tr>
        <td>${g.rate === 0 ? '非課税・不課税' : g.rate + '%対象'}${g.rate === 8 ? '（軽減税率）' : ''}</td>
        <td class="num">${yen(g.subtotal)}</td>
        <td class="num">${yen(g.tax)}</td>
        <td class="num">${yen(g.total)}</td>
      </tr>`,
    )
    .join('')
  return `
    <h2 class="inv-title">請求書</h2>
    <div class="inv-head">
      <div class="inv-client">
        <p class="inv-client-name">${esc(inv.clientName)} 御中</p>
        ${inv.subject ? `<p>件名: ${esc(inv.subject)}</p>` : ''}
        <p class="inv-total">ご請求金額 <strong>${yen(t.payable)}</strong></p>
        ${inv.dueDate ? `<p>お支払期限: ${jpDate(inv.dueDate)}</p>` : ''}
      </div>
      <div class="inv-issuer">
        <p>請求書番号: ${esc(inv.number)}</p>
        <p>発行日: ${jpDate(inv.issueDate)}</p>
        <p class="inv-issuer-name">${esc(issuer.name)}</p>
        ${issuer.registrationNumber ? `<p>登録番号: ${esc(issuer.registrationNumber)}</p>` : ''}
        ${issuer.address ? `<p>${multiline(issuer.address)}</p>` : ''}
        ${issuer.tel ? `<p>TEL: ${esc(issuer.tel)}</p>` : ''}
        ${issuer.email ? `<p>${esc(issuer.email)}</p>` : ''}
      </div>
    </div>
    <table class="inv-lines">
      <thead><tr><th>品名</th><th>数量</th><th>単価（${modeLabel}）</th><th>税率</th><th>金額（${modeLabel}）</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${hasReduced ? '<p class="inv-small">※ は軽減税率（8%）対象です。</p>' : ''}
    <table class="inv-groups">
      <thead><tr><th>税率区分</th><th>税抜金額</th><th>消費税額</th><th>税込金額</th></tr></thead>
      <tbody>${groupRows}</tbody>
    </table>
    <table class="inv-sum">
      <tr><th>小計（税抜）</th><td class="num">${yen(t.subtotal)}</td></tr>
      <tr><th>消費税額</th><td class="num">${yen(t.tax)}</td></tr>
      <tr><th>合計（税込）</th><td class="num">${yen(t.total)}</td></tr>
      ${t.withholding > 0 ? `<tr><th>源泉徴収税額</th><td class="num">-${yen(t.withholding)}</td></tr>` : ''}
      <tr class="grand"><th>ご請求額</th><td class="num">${yen(t.payable)}</td></tr>
    </table>
    ${issuer.bank ? `<div class="inv-box"><strong>お振込先</strong><p>${multiline(issuer.bank)}</p></div>` : ''}
    ${inv.notes ? `<div class="inv-box"><strong>備考</strong><p>${multiline(inv.notes)}</p></div>` : ''}
  `
}
