import './style.css'
import {
  calcTotals,
  emptyInvoice,
  formatYen,
  normalizeRegistrationNumber,
  parseNumberInput,
  validateInvoice,
  type Invoice,
  type InvoiceItem,
  type Rounding,
  type TaxRate,
} from './calc'
import { csvBlob, safeFileName } from './csv'
import { exportJson, loadData, parseImportedJson, saveData, upsertInvoice, type AppData } from './storage'

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

const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const newId = (): string => `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

let data: AppData = loadData()
let cur: Invoice = newInvoice()

function newInvoice(): Invoice {
  const inv = emptyInvoice(todayIso(), newId())
  const last = data.invoices[0]
  if (last) inv.seller = { ...last.seller }
  if (last) inv.bankInfo = last.bankInfo
  return inv
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const app = document.getElementById('app')!
let previewEl: HTMLElement
let errorsEl: HTMLElement
let statusEl: HTMLElement
let listEl: HTMLElement
let itemsBody: HTMLElement

function field(
  id: string,
  label: string,
  get: () => string,
  set: (v: string) => void,
  opts: { type?: string; multiline?: boolean; hint?: string } = {},
): HTMLElement {
  const input = opts.multiline
    ? h('textarea', { id, rows: '3' })
    : h('input', { id, type: opts.type ?? 'text', autocomplete: 'off' })
  input.value = get()
  input.addEventListener('input', () => {
    set(input.value)
    refresh()
  })
  const wrap = h('div', { class: 'field' }, h('label', { for: id }, label), input)
  if (opts.hint) wrap.append(h('small', {}, opts.hint))
  return wrap
}

function selectField<T extends string>(
  id: string,
  label: string,
  options: [T, string][],
  get: () => T,
  set: (v: T) => void,
): HTMLElement {
  const sel = h('select', { id })
  for (const [v, t] of options) sel.append(h('option', { value: v }, t))
  sel.value = get()
  sel.addEventListener('change', () => {
    set(sel.value as T)
    refresh()
  })
  return h('div', { class: 'field' }, h('label', { for: id }, label), sel)
}

function renderItemRows(): void {
  itemsBody.replaceChildren()
  cur.items.forEach((it, i) => {
    const desc = h('input', { type: 'text', 'aria-label': `品名 ${i + 1}`, class: 'it-desc', autocomplete: 'off' })
    desc.value = it.description
    desc.addEventListener('input', () => ((it.description = desc.value), refresh()))
    const qty = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量 ${i + 1}`, class: 'it-qty' })
    qty.value = Number.isFinite(it.quantity) ? String(it.quantity) : ''
    qty.addEventListener('input', () => ((it.quantity = parseNumberInput(qty.value)), refresh()))
    const price = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': `単価 ${i + 1}`, class: 'it-price' })
    price.value = Number.isFinite(it.unitPriceYen) ? String(it.unitPriceYen) : ''
    price.addEventListener('input', () => ((it.unitPriceYen = parseNumberInput(price.value)), refresh()))
    const rate = h('select', { 'aria-label': `税率 ${i + 1}`, class: 'it-rate' })
    for (const [v, t] of [['10', '10%'], ['8', '8%（軽減）'], ['0', '非課税・不課税']]) rate.append(h('option', { value: v }, t))
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => ((it.taxRate = Number(rate.value) as TaxRate), refresh()))
    const del = h('button', { type: 'button', class: 'it-del', 'aria-label': `明細${i + 1}を削除` }, '削除')
    del.addEventListener('click', () => {
      if (cur.items.length > 1) cur.items.splice(i, 1)
      else cur.items[0] = blankItem()
      renderItemRows()
      refresh()
    })
    itemsBody.append(h('tr', {}, h('td', {}, desc), h('td', {}, qty), h('td', {}, price), h('td', {}, rate), h('td', {}, del)))
  })
}

const blankItem = (): InvoiceItem => ({ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })

function renderPreview(): void {
  const inv = cur
  const t = calcTotals(inv)
  const hasReduced = inv.items.some((it) => it.taxRate === 8)
  const reg = normalizeRegistrationNumber(inv.seller.registrationNumber)
  const num = (n: number) => (Number.isFinite(n) ? String(n) : '-')

  const itemRows = inv.items.map((it, i) =>
    h(
      'tr',
      {},
      h('td', {}, (it.description || '') + (it.taxRate === 8 ? ' ※' : '')),
      h('td', { class: 'r' }, num(it.quantity)),
      h('td', { class: 'r' }, Number.isFinite(it.unitPriceYen) ? formatYen(it.unitPriceYen) : '-'),
      h('td', { class: 'r' }, it.taxRate === 0 ? '非課税' : `${it.taxRate}%`),
      h('td', { class: 'r' }, formatYen(t.lineAmountsYen[i] ?? 0)),
    ),
  )
  const rateRows = t.byRate.map((r) =>
    h(
      'tr',
      {},
      h('td', {}, r.taxRate === 0 ? '非課税・不課税 対象' : `${r.taxRate}%対象`),
      h('td', { class: 'r' }, formatYen(r.taxableYen)),
      h('td', { class: 'r' }, formatYen(r.taxYen)),
      h('td', { class: 'r' }, formatYen(r.grossYen)),
    ),
  )

  const sellerBlock = h('div', { class: 'party' }, h('strong', {}, inv.seller.name || '（発行者名）'))
  if (reg) sellerBlock.append(h('div', {}, `登録番号: ${reg}`))
  if (inv.seller.address) sellerBlock.append(h('div', { class: 'pre' }, inv.seller.address))
  if (inv.seller.contact) sellerBlock.append(h('div', {}, inv.seller.contact))

  const meta = h(
    'dl',
    { class: 'meta' },
    h('dt', {}, '請求書番号'), h('dd', {}, inv.number),
    h('dt', {}, '発行日'), h('dd', {}, inv.issueDate),
  )
  if (inv.deliveryDate) meta.append(h('dt', {}, '取引年月日'), h('dd', {}, inv.deliveryDate))
  if (inv.dueDate) meta.append(h('dt', {}, '支払期限'), h('dd', {}, inv.dueDate))

  const doc = h(
    'article',
    { class: 'doc' },
    h('h2', {}, '請求書'),
    h('div', { class: 'head' }, h('div', { class: 'client' }, h('strong', {}, `${inv.clientName || '（請求先）'} 御中`)), meta),
    sellerBlock,
    h('p', { class: 'grand' }, '請求金額（税込）', h('strong', { id: 'grand-total' }, formatYen(t.totalYen))),
    h(
      'table',
      { class: 'lines' },
      h('thead', {}, h('tr', {}, h('th', {}, '品名・内容'), h('th', {}, '数量'), h('th', {}, '単価'), h('th', {}, '税率'), h('th', {}, '金額'))),
      h('tbody', {}, ...itemRows),
    ),
    h(
      'table',
      { class: 'rates' },
      h('thead', {}, h('tr', {}, h('th', {}, '税率区分'), h('th', {}, '税抜金額'), h('th', {}, '消費税額'), h('th', {}, '税込金額'))),
      h('tbody', {}, ...rateRows),
    ),
  )
  if (hasReduced) doc.append(h('p', { class: 'small' }, '※は軽減税率（8%）対象'))
  if (inv.bankInfo) doc.append(h('div', { class: 'block' }, h('strong', {}, '振込先'), h('div', { class: 'pre' }, inv.bankInfo)))
  if (inv.note) doc.append(h('div', { class: 'block' }, h('strong', {}, '備考'), h('div', { class: 'pre' }, inv.note)))
  previewEl.replaceChildren(doc)
}

function currentErrors(): string[] {
  return validateInvoice(cur)
}

function refresh(): void {
  renderPreview()
  const errs = currentErrors()
  errorsEl.replaceChildren()
  if (errs.length) {
    errorsEl.append(h('strong', {}, '入力内容を確認してください'), h('ul', {}, ...errs.map((e) => h('li', {}, e))))
  }
  if (!cur.seller.registrationNumber.trim()) {
    errorsEl.append(
      h('p', { class: 'warn', id: 'no-reg-warning' }, '登録番号が未入力です。適格請求書として発行する場合は、登録番号の入力が必要です。'),
    )
  }
}

function setStatus(msg: string): void {
  statusEl.textContent = msg
}

function renderList(): void {
  listEl.replaceChildren()
  if (data.invoices.length === 0) {
    listEl.append(h('li', { class: 'empty' }, '保存済みの請求書はまだありません'))
    return
  }
  for (const inv of data.invoices) {
    const total = formatYen(calcTotals(inv).totalYen)
    const open = h('button', { type: 'button', class: 'link' }, `${inv.number} / ${inv.clientName || '(請求先未入力)'} / ${total}`)
    open.addEventListener('click', () => {
      cur = JSON.parse(JSON.stringify(inv, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)))
      cur.items = cur.items.map((it) => ({
        ...it,
        quantity: typeof it.quantity === 'number' ? it.quantity : NaN,
        unitPriceYen: typeof it.unitPriceYen === 'number' ? it.unitPriceYen : NaN,
      }))
      build()
      setStatus(`「${inv.number}」を読み込みました`)
    })
    const del = h('button', { type: 'button', class: 'del-saved', 'aria-label': `${inv.number}を削除` }, '削除')
    del.addEventListener('click', () => {
      if (!confirm(`「${inv.number}」を削除します。よろしいですか？`)) return
      data = { invoices: data.invoices.filter((x) => x.id !== inv.id) }
      saveData(data)
      renderList()
    })
    listEl.append(h('li', {}, open, del))
  }
}

function build(): void {
  app.replaceChildren()

  const saveBtn = h('button', { type: 'button', id: 'save', class: 'primary' }, 'この請求書を保存')
  saveBtn.addEventListener('click', () => {
    const errs = currentErrors()
    if (errs.length) return setStatus('入力エラーがあるため保存できません')
    data = upsertInvoice(data, JSON.parse(JSON.stringify(cur)))
    setStatus(saveData(data) ? '保存しました（このブラウザ内のみ）' : '保存に失敗しました（ブラウザの保存領域が使えません）')
    renderList()
  })
  const printBtn = h('button', { type: 'button', id: 'print' }, '印刷 / PDFで保存')
  printBtn.addEventListener('click', () => {
    if (currentErrors().length) return setStatus('入力エラーがあるため出力できません')
    window.print()
  })
  const csvBtn = h('button', { type: 'button', id: 'export-csv' }, '明細をCSVで保存')
  csvBtn.addEventListener('click', () => {
    if (currentErrors().length) return setStatus('入力エラーがあるため出力できません')
    download(csvBlob(cur), safeFileName(cur.number, 'csv'))
  })
  const newBtn = h('button', { type: 'button', id: 'new' }, '新しい請求書')
  newBtn.addEventListener('click', () => {
    cur = newInvoice()
    build()
    setStatus('新しい請求書を作成しました')
  })

  const exportBtn = h('button', { type: 'button', id: 'export-json' }, 'バックアップを書き出す（JSON）')
  exportBtn.addEventListener('click', () => {
    download(new Blob([exportJson(data)], { type: 'application/json;charset=utf-8' }), `invoice-maker-backup-${todayIso()}.json`)
  })
  const importInput = h('input', { type: 'file', id: 'import-json', accept: 'application/json,.json', 'aria-label': 'バックアップを読み込む' })
  importInput.addEventListener('change', async () => {
    const f = importInput.files?.[0]
    if (!f) return
    try {
      if (f.size > 5_000_000) throw new Error('ファイルが大きすぎます')
      const imported = parseImportedJson(await f.text())
      for (const inv of imported.invoices) data = upsertInvoice(data, inv)
      saveData(data)
      renderList()
      setStatus(`${imported.invoices.length}件の請求書を読み込みました`)
    } catch (e) {
      setStatus(`読み込みに失敗しました: ${e instanceof Error ? e.message : '不正なファイル'}`)
    }
    importInput.value = ''
  })

  errorsEl = h('div', { id: 'errors', class: 'errors', role: 'alert' })
  statusEl = h('p', { id: 'status', class: 'status', role: 'status' })
  previewEl = h('section', { id: 'preview', 'aria-label': 'プレビュー' })
  listEl = h('ul', { id: 'saved-list', class: 'saved' })
  itemsBody = h('tbody', {})

  const addRow = h('button', { type: 'button', id: 'add-row' }, '明細を追加')
  addRow.addEventListener('click', () => {
    if (cur.items.length >= 100) return setStatus('明細は100行までです')
    cur.items.push(blankItem())
    renderItemRows()
    refresh()
  })

  const editor = h(
    'section',
    { class: 'editor no-print', 'aria-label': '入力' },
    h('h2', {}, '発行者（あなた）'),
    field('sellerName', '氏名または名称', () => cur.seller.name, (v) => (cur.seller.name = v)),
    field('sellerReg', '登録番号（適格請求書発行事業者のみ）', () => cur.seller.registrationNumber, (v) => (cur.seller.registrationNumber = v), {
      hint: '「T」＋数字13桁。全角入力もOKです',
    }),
    field('sellerAddr', '住所', () => cur.seller.address, (v) => (cur.seller.address = v), { multiline: true }),
    field('sellerContact', '連絡先（電話・メール）', () => cur.seller.contact, (v) => (cur.seller.contact = v)),
    h('h2', {}, '請求先・日付'),
    field('clientName', '請求先の氏名または名称', () => cur.clientName, (v) => (cur.clientName = v)),
    field('number', '請求書番号', () => cur.number, (v) => (cur.number = v)),
    field('issueDate', '発行日', () => cur.issueDate, (v) => (cur.issueDate = v), { type: 'date' }),
    field('deliveryDate', '取引年月日（納品日・役務提供日）', () => cur.deliveryDate, (v) => (cur.deliveryDate = v), { type: 'date' }),
    field('dueDate', '支払期限', () => cur.dueDate, (v) => (cur.dueDate = v), { type: 'date' }),
    h('h2', {}, '明細'),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'items' },
        h('thead', {}, h('tr', {}, h('th', {}, '品名・内容'), h('th', {}, '数量'), h('th', {}, '単価(円)'), h('th', {}, '税率'), h('th', {}, ''))),
        itemsBody,
      ),
    ),
    addRow,
    h('h2', {}, '計算設定'),
    selectField('priceMode', '単価の入力方法', [['exclusive', '税抜'], ['inclusive', '税込']], () => cur.priceMode, (v) => (cur.priceMode = v)),
    selectField<Rounding>('rounding', '端数処理', [['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']], () => cur.rounding, (v) => (cur.rounding = v)),
    h('h2', {}, '振込先・備考'),
    field('bankInfo', '振込先', () => cur.bankInfo, (v) => (cur.bankInfo = v), { multiline: true }),
    field('note', '備考', () => cur.note, (v) => (cur.note = v), { multiline: true }),
    errorsEl,
    h('div', { class: 'actions' }, saveBtn, printBtn, csvBtn, newBtn),
    statusEl,
  )

  const saved = h(
    'section',
    { class: 'saved-area no-print', 'aria-label': '保存済み' },
    h('h2', {}, '保存済みの請求書'),
    listEl,
    h('div', { class: 'actions' }, exportBtn, h('label', { class: 'file-label' }, 'バックアップを読み込む ', importInput)),
    h('p', { class: 'small' }, 'データはこのブラウザの中にだけ保存され、外部には送信されません。ブラウザのデータを消去すると失われるため、定期的にバックアップを書き出してください。'),
  )

  const header = h(
    'header',
    { class: 'no-print' },
    h('h1', {}, '請求書メーカー'),
    h('p', { class: 'lead' }, '登録不要・オフライン対応。入力内容はあなたのブラウザから外に出ません。'),
  )
  const footer = h(
    'footer',
    { class: 'no-print' },
    h('p', { class: 'small' }, '本ツールは請求書作成の補助を目的としており、税務・法律上の助言ではありません。適格請求書の記載要件・端数処理・税率の扱いは、国税庁の公式情報や税理士にご確認ください。'),
  )

  app.append(header, h('main', {}, h('div', { class: 'cols' }, h('div', { class: 'left' }, editor, saved), h('div', { class: 'right' }, previewEl))), footer)
  renderItemRows()
  refresh()
  renderList()
}

build()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
