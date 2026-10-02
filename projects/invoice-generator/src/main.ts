import './style.css'
import { calcInvoice, type LineItem, type Rounding } from './calc'
import { emptyInvoice, type Invoice } from './model'
import { buildItemsCsv, buildJson, downloadFileName, loadDraft, parseImportedJson, saveDraft, triggerDownload } from './io'
import { formatYen, isValidRegistrationNumber, normalizeRegistrationNumber, parseNumber } from './text'

let inv: Invoice = loadDraft() ?? emptyInvoice()

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) e.append(c)
  return e
}

const app = document.getElementById('app')!
const preview = el('section', { id: 'preview', 'aria-label': '請求書プレビュー', class: 'sheet' })
const itemsBody = el('tbody')
const regWarn = el('p', { class: 'warn', id: 'reg-warn', role: 'status' })

function changed(): void {
  saveDraft(inv)
  renderPreview()
}

function textField(label: string, key: keyof Invoice, opts: { type?: string; multiline?: boolean; placeholder?: string; id: string }): HTMLElement {
  const input = opts.multiline
    ? el('textarea', { id: opts.id, rows: '3' })
    : el('input', { id: opts.id, type: opts.type ?? 'text', autocomplete: 'off' })
  if (opts.placeholder) input.setAttribute('placeholder', opts.placeholder)
  input.value = String(inv[key] ?? '')
  input.addEventListener('input', () => {
    ;(inv as unknown as Record<string, unknown>)[key] = input.value
    if (key === 'registrationNumber') updateRegWarn()
    changed()
  })
  return el('label', { class: 'field', for: opts.id }, el('span', {}, label), input)
}

function updateRegWarn(): void {
  const v = inv.registrationNumber.trim()
  regWarn.textContent = v === '' || isValidRegistrationNumber(v) ? '' : '登録番号は「T」+数字13桁の形式です（例: T1234567890123）。'
}

function renderItems(): void {
  itemsBody.replaceChildren()
  inv.items.forEach((it, i) => {
    const name = el('input', { type: 'text', 'aria-label': `品名 ${i + 1}`, class: 'in-name', autocomplete: 'off' })
    name.value = it.name
    name.addEventListener('input', () => { it.name = name.value; changed() })
    const qty = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量 ${i + 1}`, class: 'in-qty' })
    qty.value = String(it.quantity)
    qty.addEventListener('input', () => { it.quantity = parseNumber(qty.value, 1e6); changed() })
    const price = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価 ${i + 1}`, class: 'in-price' })
    price.value = String(it.unitPrice)
    price.addEventListener('input', () => { it.unitPrice = parseNumber(price.value); changed() })
    const rate = el('select', { 'aria-label': `税率 ${i + 1}`, class: 'in-rate' }, el('option', { value: '10' }, '10%'), el('option', { value: '8' }, '8%（軽減）'))
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => { it.taxRate = rate.value === '8' ? 8 : 10; changed() })
    const del = el('button', { type: 'button', class: 'btn-small', 'aria-label': `明細 ${i + 1} を削除` }, '削除')
    del.addEventListener('click', () => {
      inv.items.splice(i, 1)
      if (inv.items.length === 0) inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
      renderItems(); changed()
    })
    itemsBody.append(el('tr', {}, el('td', {}, name), el('td', {}, qty), el('td', {}, price), el('td', {}, rate), el('td', {}, del)))
  })
}

function renderPreview(): void {
  const t = calcInvoice(inv)
  const hasReduced = inv.items.some((it) => it.taxRate === 8)
  const children: Node[] = []
  children.push(el('h2', {}, '請求書'))
  const meta = el('dl', { class: 'meta' })
  const row = (k: string, v: string) => meta.append(el('dt', {}, k), el('dd', {}, v || ' '))
  row('請求書番号', inv.invoiceNumber)
  row('発行日', inv.issueDate)
  row('お支払期限', inv.dueDate)
  children.push(meta)
  children.push(el('p', { class: 'client' }, (inv.clientName || '（請求先未入力）') + ' 御中'))
  if (inv.subject) children.push(el('p', { class: 'subject' }, '件名: ' + inv.subject))
  children.push(el('p', { class: 'grand' }, `ご請求金額 ${formatYen(t.payableYen)}`))
  const issuer = el('div', { class: 'issuer' }, el('strong', {}, inv.issuerName || '（発行者未入力）'))
  if (inv.issuerAddress) issuer.append(el('div', { class: 'pre' }, inv.issuerAddress))
  const reg = normalizeRegistrationNumber(inv.registrationNumber)
  if (reg) issuer.append(el('div', {}, '登録番号: ' + reg))
  children.push(issuer)

  const table = el('table', { class: 'lines' })
  table.append(el('thead', {}, el('tr', {}, ...['品名', '数量', '単価', '税率', '金額'].map((h) => el('th', {}, h)))))
  const tb = el('tbody')
  inv.items.forEach((it, i) => {
    tb.append(el('tr', {},
      el('td', {}, (it.name || '（品名未入力）') + (it.taxRate === 8 ? ' ※' : '')),
      el('td', { class: 'num' }, String(it.quantity)),
      el('td', { class: 'num' }, formatYen(it.unitPrice)),
      el('td', { class: 'num' }, it.taxRate + '%'),
      el('td', { class: 'num' }, formatYen(t.lineAmounts[i])),
    ))
  })
  table.append(tb)
  children.push(table)
  if (hasReduced) children.push(el('p', { class: 'small' }, '※は軽減税率（8%）対象品目です。'))

  const sum = el('table', { class: 'sum' })
  const srow = (k: string, v: string, cls = '') => sum.append(el('tr', { class: cls }, el('th', {}, k), el('td', { class: 'num' }, v)))
  for (const r of t.rates) {
    srow(`${r.rate}%対象 ${inv.priceMode === 'exclusive' ? '(税抜)' : '(税抜換算)'}`, formatYen(r.taxableYen))
    srow(`${r.rate}%消費税額`, formatYen(r.taxYen))
  }
  srow('合計（税込）', formatYen(t.totalYen), 'strong')
  if (inv.withholding) {
    srow('源泉徴収税額', '-' + formatYen(t.withholdingYen))
    srow('差引請求額', formatYen(t.payableYen), 'strong')
  }
  children.push(sum)
  if (inv.bankInfo) children.push(el('div', { class: 'block' }, el('strong', {}, '振込先'), el('div', { class: 'pre' }, inv.bankInfo)))
  if (inv.notes) children.push(el('div', { class: 'block' }, el('strong', {}, '備考'), el('div', { class: 'pre' }, inv.notes)))
  preview.replaceChildren(...children)
}

function build(): void {
  const form = el('section', { id: 'form', 'aria-label': '請求書の入力' })
  form.append(
    textField('請求書番号', 'invoiceNumber', { id: 'f-number', placeholder: 'INV-0001' }),
    textField('発行日', 'issueDate', { id: 'f-issue', type: 'date' }),
    textField('お支払期限', 'dueDate', { id: 'f-due', type: 'date' }),
    textField('発行者名（屋号・氏名・法人名）', 'issuerName', { id: 'f-issuer' }),
    textField('発行者の住所', 'issuerAddress', { id: 'f-address', multiline: true }),
    textField('登録番号（T+13桁）', 'registrationNumber', { id: 'f-reg', placeholder: 'T1234567890123' }),
    regWarn,
    textField('請求先名（御中は自動付与）', 'clientName', { id: 'f-client' }),
    textField('件名', 'subject', { id: 'f-subject' }),
  )

  const mode = el('select', { id: 'f-mode' }, el('option', { value: 'exclusive' }, '税抜（外税）'), el('option', { value: 'inclusive' }, '税込（内税）'))
  mode.value = inv.priceMode
  mode.addEventListener('change', () => { inv.priceMode = mode.value === 'inclusive' ? 'inclusive' : 'exclusive'; changed() })
  const rounding = el('select', { id: 'f-rounding' }, el('option', { value: 'floor' }, '切り捨て'), el('option', { value: 'round' }, '四捨五入'), el('option', { value: 'ceil' }, '切り上げ'))
  rounding.value = inv.rounding
  rounding.addEventListener('change', () => { inv.rounding = rounding.value as Rounding; changed() })
  const wh = el('input', { id: 'f-withholding', type: 'checkbox' })
  wh.checked = inv.withholding
  wh.addEventListener('change', () => { inv.withholding = wh.checked; changed() })
  form.append(
    el('label', { class: 'field', for: 'f-mode' }, el('span', {}, '単価の金額区分'), mode),
    el('label', { class: 'field', for: 'f-rounding' }, el('span', {}, '消費税の端数処理（税率ごとに1回）'), rounding),
    el('label', { class: 'check', for: 'f-withholding' }, wh, el('span', {}, '源泉徴収を差し引く（報酬・料金等に該当する場合）')),
  )

  const addBtn = el('button', { type: 'button', id: 'add-item' }, '＋ 明細を追加')
  addBtn.addEventListener('click', () => {
    if (inv.items.length >= 200) return
    inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 } as LineItem)
    renderItems(); changed()
  })
  form.append(
    el('h3', {}, '明細'),
    el('div', { class: 'table-wrap' }, el('table', { class: 'items' }, el('thead', {}, el('tr', {}, ...['品名', '数量', '単価(円)', '税率', ''].map((h) => el('th', {}, h)))), itemsBody)),
    addBtn,
    textField('振込先', 'bankInfo', { id: 'f-bank', multiline: true }),
    textField('備考', 'notes', { id: 'f-notes', multiline: true }),
  )

  const printBtn = el('button', { type: 'button', id: 'btn-print', class: 'primary' }, 'PDFとして保存 / 印刷')
  printBtn.addEventListener('click', () => window.print())
  const csvBtn = el('button', { type: 'button', id: 'btn-csv' }, '明細CSVを保存')
  csvBtn.addEventListener('click', () => triggerDownload(buildItemsCsv(inv), 'text/csv', downloadFileName(inv, 'csv')))
  const jsonBtn = el('button', { type: 'button', id: 'btn-json' }, 'データを保存(JSON)')
  jsonBtn.addEventListener('click', () => triggerDownload(buildJson(inv), 'application/json', downloadFileName(inv, 'json')))
  const importMsg = el('p', { id: 'import-msg', role: 'status', class: 'warn' })
  const file = el('input', { id: 'btn-import', type: 'file', accept: '.json,application/json' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) return
    const parsed = parseImportedJson(await f.text())
    if (!parsed) { importMsg.textContent = '読み込めませんでした。このツールで保存したJSONファイルを選んでください。'; return }
    inv = parsed
    importMsg.textContent = ''
    app.replaceChildren()
    build()
    changed()
  })
  const clear = el('button', { type: 'button', id: 'btn-clear' }, '新規作成（入力を消去）')
  clear.addEventListener('click', () => {
    if (!confirm('現在の入力を消去します。よろしいですか？')) return
    inv = emptyInvoice()
    app.replaceChildren()
    build()
    changed()
  })
  form.append(el('div', { class: 'actions' }, printBtn, csvBtn, jsonBtn, clear), el('label', { class: 'field' }, el('span', {}, 'JSONを読み込む'), file), importMsg)

  const header = el('header', { class: 'top' },
    el('h1', {}, 'インボイス請求書ジェネレーター'),
    el('p', {}, '登録不要・オフライン対応。入力内容はこの端末のブラウザ内にのみ保存され、外部には送信されません。'))
  const disclaimer = el('footer', { class: 'disclaimer' },
    el('p', {}, '本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。記載事項・税額の計算は取引内容に応じてご自身（必要に応じて税理士）でご確認ください。登録番号の実在確認は国税庁の適格請求書発行事業者公表サイトで行ってください。'))
  app.append(header, el('main', {}, form, preview), disclaimer)
  updateRegWarn()
  renderItems()
  renderPreview()
}

build()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
