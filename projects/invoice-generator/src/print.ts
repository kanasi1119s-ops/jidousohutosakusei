import { computeInvoiceTotals, type Invoice } from './invoice'
import type { Profile } from './storage'
import { escapeHtml, formatYen } from './util'

const RATE_LABEL: Record<number, string> = { 10: '10%対象', 8: '8%対象（軽減税率）', 0: '対象外・非課税' }

/**
 * PDFはjsPDF等のクライアントサイド生成ライブラリではなく、ブラウザ標準の印刷（PDF保存）機能を利用する。
 * jsPDFの既定フォントは日本語グリフを含まず、日本語埋め込みには数MB規模のフォント同梱が必要になるため、
 * OSに任せた印刷（Ctrl+P → PDFとして保存）の方が文字化けリスクが低く、依存も増えない。
 */
export function buildInvoicePrintHtml(invoice: Invoice, profile: Profile): string {
  const totals = computeInvoiceTotals(invoice.items)
  const itemRows = invoice.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatYen(item.unitPriceYen)}</td>
          <td class="num">${item.taxRate === 0 ? '-' : item.taxRate + '%'}</td>
          <td class="num">${formatYen(item.quantity * item.unitPriceYen)}</td>
        </tr>`,
    )
    .join('')

  const rateRows = totals.rateGroups
    .map(
      (g) => `
        <tr>
          <td>${RATE_LABEL[g.taxRate]}</td>
          <td class="num">${formatYen(g.subtotalYen)}</td>
          <td class="num">${formatYen(g.taxYen)}</td>
        </tr>`,
    )
    .join('')

  return `
    <div class="print-sheet">
      <h1>請求書</h1>
      <div class="print-header">
        <div class="print-to">
          <p class="client-name">${escapeHtml(invoice.clientName)} 様</p>
          <p>${escapeHtml(invoice.clientAddress)}</p>
        </div>
        <div class="print-from">
          <p>請求書番号: ${escapeHtml(invoice.number)}</p>
          <p>発行日: ${escapeHtml(invoice.issueDate)}</p>
          <p>お支払期限: ${escapeHtml(invoice.dueDate || '-')}</p>
          <p class="business-name">${escapeHtml(profile.businessName)}</p>
          <p>${escapeHtml(profile.address)}</p>
          <p>登録番号: ${escapeHtml(profile.registrationNumber)}</p>
        </div>
      </div>

      <p class="print-total-headline">ご請求金額（税込）: <strong>${formatYen(totals.grandTotalYen)}</strong></p>

      <table class="print-items">
        <thead>
          <tr><th>品目</th><th>数量</th><th>単価</th><th>税率</th><th>金額（税抜）</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table class="print-tax-summary">
        <thead><tr><th>税率区分</th><th>対象金額（税抜）</th><th>消費税額</th></tr></thead>
        <tbody>${rateRows}</tbody>
      </table>

      ${invoice.notes ? `<p class="print-notes">${escapeHtml(invoice.notes)}</p>` : ''}

      <div class="print-bank">
        <p>お支払先: ${escapeHtml(profile.bankInfo || '(未設定)')}</p>
      </div>

      <p class="print-footnote">
        本請求書は適格請求書（インボイス）の記載要件を参考に作成した簡易ツールの出力です。
        記載内容の最終確認は発行者ご自身の責任で行ってください。
      </p>
    </div>
  `
}

export function printInvoice(invoice: Invoice, profile: Profile): void {
  const container = document.getElementById('print-area')
  if (!container) throw new Error('印刷用の領域が見つかりません。')
  container.innerHTML = buildInvoicePrintHtml(invoice, profile)
  window.print()
}
