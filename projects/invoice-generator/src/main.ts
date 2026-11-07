import './style.css'
import {
  calcTotals,
  formatYen,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumberInput,
  type Rounding,
  type TaxRate,
} from './calc'
import { buildInvoiceCsv, csvFileName, jsonFileName } from './csv'
import { emptyInvoice, type Invoice } from './model'
import { invoiceToJson, loadInvoice, parseInvoiceJson, saveInvoice } from './storage'

function todayString(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

type Child = Node | string
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

let inv: Invoice = loadInvoice(todayString()) ?? emptyInvoice(todayString())
const app = document.getElementById('app') as HTMLElement
const preview = h('section', { id: 'preview', class: 'sheet', 'aria-label': '請求書プレビュー' })
const itemsBody = h('tbody', { id: 'items-body' })
const messages = h('p', { id: 'messages', role: 'status', class: 'msg' })

function persist() {
  saveInvoice(inv)
  renderPreview()
}

function textField(id: string, label: string, key: keyof Invoice, opts: { multiline?: boolean; type?: string } = {}) {
  const input = opts.multiline
    ? h('textarea', { id, rows: '3' })
    : h('input', { id, type: opts.type ?? 'text', autocomplete: 'off' })
  ;(input as HTMLInputElement).value = String(inv[key] ?? '')
  input.addEventListener('input', () => {
    ;(inv as unknown as Record<string, unknown>)[key] = (input as HTMLInputElement).value
    persist()
  })
  return h('label', { for: id }, label, input)
}

function renderItems() {
  itemsBody.replaceChildren()
  inv.items.forEach((item, idx) => {
    const name = h('input', { type: 'text', 'aria-label': `品名 ${idx + 1}`, class: 'it-name' })
    name.value = item.name
    name.addEventListener('input', () => {
      item.name = name.value
      persist()
    })
    const qty = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量 ${idx + 1}`, class: 'it-qty' })
    qty.value = String(item.quantity)
    qty.addEventListener('input', () => {
      const n = parseNumberInput(qty.value)
      item.quantity = Number.isFinite(n) && n >= 0 ? n : 0
      persist()
    })
    const price = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価 ${idx + 1}`, class: 'it-price' })
    price.value = String(item.unitPrice)
    price.addEventListener('input', () => {
      const n = parseNumberInput(price.value)
      item.unitPrice = Number.isFinite(n) ? n : 0
      persist()
    })
    const rate = h('select', { 'aria-label': `税率 ${idx + 1}`, class: 'it-rate' })
    rate.append(h('option', { value: '10' }, '10%'), h('option', { value: '8' }, '8%（軽減）'))
    rate.value = String(item.taxRate)
    rate.addEventListener('change', () => {
      item.taxRate = Number(rate.value) as TaxRate
      persist()
    })
    const del = h('button', { type: 'button', class: 'danger', 'aria-label': `明細 ${idx + 1} を削除` }, '削除')
    del.addEventListener('click', () => {
      inv.items.splice(idx, 1)
      if (inv.items.length === 0) inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
      renderItems()
      persist()
    })
    itemsBody.append(
      h('tr', {}, h('td', {}, name), h('td', {}, qty), h('td', {}, price), h('td', {}, rate), h('td', {}, del)),
    )
  })
}

function renderPreview() {
  const t = calcTotals(inv.items, inv.rounding)
  const regOk = inv.issuerRegistration === '' || isValidRegistrationNumber(inv.issuerRegistration)
  const reg = normalizeRegistrationNumber(inv.issuerRegistration)
  const hasReduced = inv.items.some((i) => i.taxRate === 8)
  const rows = inv.items
    .filter((i) => i.name !== '' || i.unitPrice !== 0)
    .map((i) =>
      h(
        'tr',
        {},
        h('td', {}, i.name + (i.taxRate === 8 ? ' ※' : '')),
        h('td', { class: 'num' }, String(i.quantity)),
        h('td', { class: 'num' }, formatYen(i.unitPrice)),
        h('td', { class: 'num' }, `${i.taxRate}%`),
        h('td', { class: 'num' }, formatYen(lineAmount(i))),
      ),
    )
  const summary = t.byRate.map((r) =>
    h(
      'tr',
      {},
      h('th', {}, `${r.rate}%対象（税抜）`),
      h('td', { class: 'num' }, formatYen(r.subtotal)),
      h('th', {}, `消費税（${r.rate}%）`),
      h('td', { class: 'num' }, formatYen(r.tax)),
    ),
  )
  preview.replaceChildren(
    h('h2', {}, '請求書'),
    h(
      'div',
      { class: 'meta' },
      h('p', {}, `請求書番号: ${inv.invoiceNumber}`),
      h('p', {}, `発行日: ${inv.issueDate}`),
      ...(inv.dueDate ? [h('p', {}, `お支払期限: ${inv.dueDate}`)] : []),
    ),
    h('p', { class: 'customer' }, `${inv.customerName || '（請求先未入力）'} 御中`),
    h(
      'div',
      { class: 'issuer' },
      h('p', {}, inv.issuerName || '（発行者名未入力）'),
      h('p', {}, inv.issuerRegistration ? `登録番号: ${reg}` : '登録番号: （未入力）'),
      ...(inv.issuerAddress ? [h('p', { class: 'pre' }, inv.issuerAddress)] : []),
    ),
    ...(regOk ? [] : [h('p', { class: 'warn', id: 'reg-warn' }, '登録番号は「T」+数字13桁の形式で入力してください。')]),
    h('p', { class: 'total' }, `ご請求金額（税込）: ${formatYen(t.total)}`),
    h(
      'table',
      { class: 'lines' },
      h('thead', {}, h('tr', {}, ...['品名', '数量', '単価', '税率', '金額（税抜）'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...rows),
    ),
    ...(hasReduced ? [h('p', { class: 'small' }, '※ は軽減税率（8%）対象')] : []),
    h('table', { class: 'summary' }, h('tbody', {}, ...summary)),
    ...(inv.bankInfo ? [h('p', { class: 'pre' }, `お振込先:\n${inv.bankInfo}`)] : []),
    ...(inv.notes ? [h('p', { class: 'pre' }, `備考:\n${inv.notes}`)] : []),
  )
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function setMessage(text: string) {
  messages.textContent = text
}

function rerenderAll() {
  app.replaceChildren()
  build()
}

function build() {
  const roundSel = h('select', { id: 'rounding' })
  roundSel.append(
    h('option', { value: 'floor' }, '切り捨て'),
    h('option', { value: 'round' }, '四捨五入'),
    h('option', { value: 'ceil' }, '切り上げ'),
  )
  roundSel.value = inv.rounding
  roundSel.addEventListener('change', () => {
    inv.rounding = roundSel.value as Rounding
    persist()
  })

  const add = h('button', { type: 'button', id: 'add-item' }, '明細を追加')
  add.addEventListener('click', () => {
    if (inv.items.length >= 200) return setMessage('明細は200行までです。')
    inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
    renderItems()
    persist()
  })

  const printBtn = h('button', { type: 'button', id: 'print' }, '印刷 / PDFとして保存')
  printBtn.addEventListener('click', () => window.print())

  const csvBtn = h('button', { type: 'button', id: 'export-csv' }, 'CSVをダウンロード')
  csvBtn.addEventListener('click', () =>
    download(new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' }), csvFileName(inv)),
  )
  const jsonBtn = h('button', { type: 'button', id: 'export-json' }, 'バックアップ(JSON)を保存')
  jsonBtn.addEventListener('click', () =>
    download(new Blob([invoiceToJson(inv)], { type: 'application/json;charset=utf-8' }), jsonFileName(inv)),
  )
  const file = h('input', { type: 'file', id: 'import-json', accept: '.json,application/json', class: 'visually-hidden' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) return
    if (f.size > 2_000_000) return setMessage('ファイルが大きすぎます（2MBまで）。')
    const parsed = parseInvoiceJson(await f.text(), todayString())
    if (!parsed) return setMessage('読み込めませんでした。このツールで保存したJSONファイルを選んでください。')
    inv = parsed
    saveInvoice(inv)
    rerenderAll()
    setMessage('バックアップを読み込みました。')
  })
  const importLabel = h('label', { class: 'btn', for: 'import-json' }, 'バックアップを読み込む')
  const resetBtn = h('button', { type: 'button', id: 'reset', class: 'danger' }, '入力をすべて消去')
  resetBtn.addEventListener('click', () => {
    if (!confirm('入力内容をすべて消去します。よろしいですか？')) return
    inv = emptyInvoice(todayString())
    saveInvoice(inv)
    rerenderAll()
  })

  renderItems()
  renderPreview()

  app.append(
    h(
      'header',
      { class: 'top' },
      h('h1', {}, 'インボイス請求書ジェネレーター'),
      h('p', {}, '入力した内容はこのブラウザの中だけに保存され、外部へ送信されません。登録不要・オフラインでも使えます。'),
    ),
    h(
      'main',
      { class: 'layout' },
      h(
        'div',
        { class: 'form' },
        h(
          'fieldset',
          {},
          h('legend', {}, '発行者（あなた）'),
          textField('issuerName', '氏名または名称', 'issuerName'),
          textField('issuerRegistration', '登録番号（T+13桁）', 'issuerRegistration'),
          textField('issuerAddress', '住所・連絡先', 'issuerAddress', { multiline: true }),
          textField('bankInfo', '振込先', 'bankInfo', { multiline: true }),
        ),
        h(
          'fieldset',
          {},
          h('legend', {}, '請求内容'),
          textField('customerName', '請求先名称', 'customerName'),
          textField('invoiceNumber', '請求書番号', 'invoiceNumber'),
          textField('issueDate', '発行日（取引年月日）', 'issueDate', { type: 'date' }),
          textField('dueDate', 'お支払期限', 'dueDate', { type: 'date' }),
          h('label', { for: 'rounding' }, '消費税の端数処理', roundSel),
          textField('notes', '備考', 'notes', { multiline: true }),
        ),
        h(
          'fieldset',
          {},
          h('legend', {}, '明細（単価は税抜）'),
          h(
            'div',
            { class: 'tablewrap' },
            h(
              'table',
              { class: 'items' },
              h('thead', {}, h('tr', {}, ...['品名', '数量', '単価(税抜)', '税率', ''].map((x) => h('th', {}, x)))),
              itemsBody,
            ),
          ),
          add,
        ),
        h('div', { class: 'actions' }, printBtn, csvBtn, jsonBtn, importLabel, file, resetBtn),
        messages,
        h(
          'p',
          { class: 'disclaimer' },
          '本ツールは書式作成の補助です。税務上の取扱い・記載要件の最終確認は、国税庁の公表資料または税理士等の専門家にご確認ください。',
        ),
      ),
      preview,
    ),
  )
}

build()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
