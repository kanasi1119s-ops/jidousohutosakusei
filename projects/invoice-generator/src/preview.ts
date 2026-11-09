import { calculate, type Invoice } from './invoice'
import { escapeHtml as e, yen, jpDate } from './format'

export function renderInvoiceHtml(inv: Invoice): string {
  const c = calculate(inv.items, inv.priceMode, inv.rounding)
  const incl = inv.priceMode === 'inclusive'
  const hasReduced = inv.items.some((i) => i.rate === 8)
  const rows = inv.items
    .map((it, i) => {
      const mark = it.rate === 8 ? '※' : ''
      return `<tr><td>${e(it.name)}${mark}</td><td class="r">${e(String(it.quantity))}${e(it.unit)}</td><td class="r">${yen(it.unitPrice)}</td><td class="r">${it.rate}%</td><td class="r">${yen(c.lineAmounts[i])}</td></tr>`
    })
    .join('')
  const rateRows = c.byRate
    .map((r) => `<tr><td>${r.rate}%対象${r.rate === 8 ? '（軽減税率）' : ''}</td><td class="r">${yen(r.base)}</td><td class="r">${yen(r.tax)}</td><td class="r">${yen(r.gross)}</td></tr>`)
    .join('')
  const reg = inv.issuer.registrationNumber
  return `
    <h2>請 求 書</h2>
    <div class="head">
      <div>
        <div class="to">${e(inv.customerName)} 御中</div>
        <p>下記のとおりご請求申し上げます。</p>
      </div>
      <div class="issuer">
        <div>請求書番号: ${e(inv.number)}</div>
        <div>発行日: ${e(jpDate(inv.issueDate))}</div>
        <div><strong>${e(inv.issuer.name)}</strong></div>
        ${reg ? `<div>登録番号: ${e(reg)}</div>` : ''}
        ${inv.issuer.address ? `<div>${e(inv.issuer.address)}</div>` : ''}
        ${inv.issuer.contact ? `<div>${e(inv.issuer.contact)}</div>` : ''}
      </div>
    </div>
    <div class="grand">ご請求金額（税込）: <strong>${yen(c.gross)}</strong></div>
    ${inv.dueDate ? `<div>お支払期限: ${e(jpDate(inv.dueDate))}</div>` : ''}
    <div class="tbl-wrap"><table>
      <thead><tr><th>品名</th><th>数量</th><th>単価${incl ? '（税込）' : '（税抜）'}</th><th>税率</th><th>金額${incl ? '（税込）' : '（税抜）'}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${hasReduced ? '<div>※は軽減税率（8%）対象品目です。</div>' : ''}
    <div class="tbl-wrap"><table>
      <thead><tr><th>税率区分</th><th>対価の額（税抜）</th><th>消費税額等</th><th>対価の額（税込）</th></tr></thead>
      <tbody>${rateRows}
        <tr><th>合計</th><td class="r">${yen(c.base)}</td><td class="r">${yen(c.tax)}</td><td class="r">${yen(c.gross)}</td></tr>
      </tbody>
    </table></div>
    ${inv.issuer.bank ? `<div class="pre"><strong>お振込先</strong>\n${e(inv.issuer.bank)}</div>` : ''}
    ${inv.note ? `<div class="pre"><strong>備考</strong>\n${e(inv.note)}</div>` : ''}
  `
}
