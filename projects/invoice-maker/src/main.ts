import './style.css'
import { calcTotals, formatYen, isValidRegistrationNumber, lineAmountYen, parseNumberLoose, type RoundingMode, type TaxRate } from './calc'
import { buildInvoiceCsvBlob } from './csv'
import { emptyInvoice, type Invoice } from './model'
import { downloadName, invoiceToJsonBlob, loadDraft, parseInvoiceFromJsonText, saveDraft } from './storage'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const TEXT_IDS = ['issuerName', 'issuerAddress', 'registrationNumber', 'recipientName', 'invoiceNumber', 'issueDate', 'dueDate', 'bankInfo', 'notes'] as const

const MAX_VALUE = 999_999_999

let invoice: Invoice = loadDraft() ?? emptyInvoice()
// 数量・単価の入力途中の文字列（全角入力などを許容するため）
let rawInputs: { q: string; p: string }[] = []

function resetRaw() {
  rawInputs = invoice.items.map((i) => ({ q: String(i.quantity), p: String(i.unitPriceYen) }))
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag)
  const { class: cls, ...rest } = props as Record<string, unknown>
  if (cls) el.className = cls as string
  Object.assign(el, rest)
  for (const c of children) el.append(c)
  return el
}

function collectErrors(): string[] {
  const errs: string[] = []
  invoice.items.forEach((_, idx) => {
    const q = parseNumberLoose(rawInputs[idx].q)
    const p = parseNumberLoose(rawInputs[idx].p)
    if (Number.isNaN(q) || q < 0 || q > MAX_VALUE) errs.push(`明細${idx + 1}: 数量は0以上${MAX_VALUE.toLocaleString('ja-JP')}以下の数値で入力してください。`)
    if (Number.isNaN(p) || p < 0 || p > MAX_VALUE) errs.push(`明細${idx + 1}: 単価は0以上${MAX_VALUE.toLocaleString('ja-JP')}以下の数値で入力してください。`)
  })
  return errs
}

function syncItemsFromRaw() {
  invoice.items.forEach((it, idx) => {
    const q = parseNumberLoose(rawInputs[idx].q)
    const p = parseNumberLoose(rawInputs[idx].p)
    it.quantity = Number.isNaN(q) || q < 0 || q > MAX_VALUE ? 0 : q
    it.unitPriceYen = Number.isNaN(p) || p < 0 || p > MAX_VALUE ? 0 : p
  })
}

function renderItems() {
  const box = $('items')
  box.replaceChildren()
  invoice.items.forEach((item, idx) => {
    const name = h('input', { type: 'text', value: item.name, placeholder: '品目（例: Webサイト制作）' })
    name.setAttribute('aria-label', `明細${idx + 1} 品目`)
    name.dataset.role = 'item-name'
    name.addEventListener('input', () => { item.name = name.value; update() })
    const q = h('input', { type: 'text', value: rawInputs[idx].q })
    q.inputMode = 'decimal'
    q.setAttribute('aria-label', `明細${idx + 1} 数量`)
    q.dataset.role = 'item-qty'
    q.addEventListener('input', () => { rawInputs[idx].q = q.value; update() })
    const p = h('input', { type: 'text', value: rawInputs[idx].p })
    p.inputMode = 'decimal'
    p.setAttribute('aria-label', `明細${idx + 1} 単価(税抜)`)
    p.dataset.role = 'item-price'
    p.addEventListener('input', () => { rawInputs[idx].p = p.value; update() })
    const rate = h('select')
    rate.setAttribute('aria-label', `明細${idx + 1} 税率`)
    rate.dataset.role = 'item-rate'
    rate.append(h('option', { value: '10', textContent: '10%' }), h('option', { value: '8', textContent: '8%（軽減）' }))
    rate.value = String(item.taxRate)
    rate.addEventListener('change', () => { item.taxRate = Number(rate.value) as TaxRate; update() })
    const del = h('button', { type: 'button', class: 'secondary small', textContent: '削除' })
    del.setAttribute('aria-label', `明細${idx + 1}を削除`)
    del.addEventListener('click', () => {
      if (invoice.items.length <= 1) return
      invoice.items.splice(idx, 1)
      rawInputs.splice(idx, 1)
      renderItems()
      update()
    })
    box.append(h('div', { class: 'item-row' }, name, q, p, rate, del))
  })
}

function renderPreview(errors: string[]) {
  const pv = $('preview')
  pv.replaceChildren()
  const t = calcTotals(invoice.items, invoice.rounding as RoundingMode)
  const hasReduced = invoice.items.some((i) => i.taxRate === 8)
  const registered = isValidRegistrationNumber(invoice.registrationNumber)

  pv.append(h('h2', { class: 'doc-title', textContent: registered ? '請求書（適格請求書）' : '請求書' }))
  const head = h('div', { class: 'doc-head' })
  head.append(
    h('div', {}, h('div', { class: 'doc-recipient', textContent: (invoice.recipientName || '（請求先）') + ' 御中' })),
    h('div', { class: 'doc-issuer' },
      h('div', { textContent: invoice.issuerName || '（発行者名）' }),
      h('div', { textContent: invoice.issuerAddress }),
      h('div', { textContent: registered ? `登録番号: ${invoice.registrationNumber}` : '' }),
      h('div', { textContent: invoice.invoiceNumber ? `請求書番号: ${invoice.invoiceNumber}` : '' }),
      h('div', { textContent: invoice.issueDate ? `取引年月日: ${invoice.issueDate}` : '' }),
    ),
  )
  pv.append(head)
  pv.append(h('div', { class: 'doc-total', id: 'grand-total', textContent: `ご請求金額（税込）: ${formatYen(t.totalYen)}` }))
  if (invoice.dueDate) pv.append(h('div', { textContent: `お支払期限: ${invoice.dueDate}` }))

  const table = h('table', { class: 'doc-table' })
  table.append(h('thead', {}, h('tr', {}, ...['品目', '数量', '単価(税抜)', '税率', '金額(税抜)'].map((s) => h('th', { textContent: s })))))
  const tb = h('tbody')
  invoice.items.forEach((i) => {
    tb.append(h('tr', {},
      h('td', { textContent: (i.name || '（品目）') + (i.taxRate === 8 ? ' ※' : '') }),
      h('td', { class: 'num', textContent: String(i.quantity) }),
      h('td', { class: 'num', textContent: formatYen(i.unitPriceYen) }),
      h('td', { class: 'num', textContent: `${i.taxRate}%` }),
      h('td', { class: 'num', textContent: formatYen(lineAmountYen(i)) }),
    ))
  })
  table.append(tb)
  pv.append(table)
  if (hasReduced) pv.append(h('p', { class: 'small-note', textContent: '※は軽減税率（8%）対象品目です。' }))

  const sum = h('table', { class: 'doc-table sum' })
  const sb = h('tbody')
  t.breakdowns.forEach((b) => {
    const tr = h('tr', {},
      h('th', { textContent: `${b.taxRate}%対象` }),
      h('td', { class: 'num', textContent: `税抜 ${formatYen(b.subtotalYen)}` }),
      h('td', { class: 'num', textContent: `消費税 ${formatYen(b.taxYen)}` }),
      h('td', { class: 'num', textContent: `税込 ${formatYen(b.totalYen)}` }),
    )
    tr.dataset.rate = String(b.taxRate)
    sb.append(tr)
  })
  sum.append(sb)
  pv.append(sum)
  if (invoice.bankInfo) pv.append(h('div', { class: 'doc-block', textContent: `振込先: ${invoice.bankInfo}` }))
  if (invoice.notes) pv.append(h('div', { class: 'doc-block', textContent: `備考: ${invoice.notes}` }))
  if (errors.length) pv.dataset.invalid = 'true'
  else delete pv.dataset.invalid
}

function update() {
  syncItemsFromRaw()
  const errors = collectErrors()
  $('errors').textContent = errors.join(' ')
  const reg = invoice.registrationNumber
  $('reg-error').textContent = reg && !isValidRegistrationNumber(reg) ? '登録番号は「T」+ 半角数字13桁で入力してください（例: T1234567890123）。形式が正しくない間は適格請求書として表示されません。' : ''
  renderPreview(errors)
  saveDraft(invoice)
}

function setStatus(msg: string) {
  $('status').textContent = msg
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fillForm() {
  for (const id of TEXT_IDS) $<HTMLInputElement>(id).value = invoice[id]
  $<HTMLSelectElement>('rounding').value = invoice.rounding
}

function init() {
  resetRaw()
  fillForm()
  for (const id of TEXT_IDS) {
    $<HTMLInputElement>(id).addEventListener('input', (e) => {
      invoice[id] = (e.target as HTMLInputElement).value
      update()
    })
  }
  $<HTMLSelectElement>('rounding').addEventListener('change', (e) => {
    invoice.rounding = (e.target as HTMLSelectElement).value as RoundingMode
    update()
  })
  $('add-item').addEventListener('click', () => {
    if (invoice.items.length >= 500) return
    invoice.items.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
    rawInputs.push({ q: '1', p: '0' })
    renderItems()
    update()
  })
  $('print').addEventListener('click', () => window.print())
  $('export-csv').addEventListener('click', () => {
    if (collectErrors().length) return setStatus('入力エラーを直してからCSVを出力してください。')
    download(buildInvoiceCsvBlob(invoice), downloadName('invoice', 'csv'))
    setStatus('CSVをダウンロードしました（Excel対応のUTF-8）。')
  })
  $('export-json').addEventListener('click', () => {
    download(invoiceToJsonBlob(invoice), downloadName('invoice-backup', 'json'))
    setStatus('バックアップ(JSON)をダウンロードしました。')
  })
  $<HTMLInputElement>('import-json').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('ファイルが大きすぎます（上限2MB）。')
      invoice = parseInvoiceFromJsonText(await file.text())
      resetRaw()
      fillForm()
      renderItems()
      update()
      setStatus('バックアップを読み込みました。')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '読み込みに失敗しました。')
    } finally {
      input.value = ''
    }
  })
  $('clear').addEventListener('click', () => {
    if (!window.confirm('入力内容をすべて消去します。よろしいですか？（バックアップは消えません）')) return
    invoice = emptyInvoice()
    resetRaw()
    fillForm()
    renderItems()
    update()
    setStatus('入力を消去しました。')
  })
  renderItems()
  update()
}

init()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
