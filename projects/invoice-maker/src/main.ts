import './style.css'
import {
  calculate,
  MAX_ITEMS,
  MAX_QUANTITY,
  MAX_UNIT_PRICE_YEN,
  type CalcResult,
  type LineItem,
  type PriceMode,
  type RoundingMode,
  type TaxRate,
} from './calc'
import { checkInvoice } from './checks'
import { buildInvoiceCsvBlob, csvDownloadFileName, jsonDownloadFileName } from './csv'
import {
  backupToBlob,
  buildBackup,
  newInvoice,
  newItem,
  parseBackupText,
  type Invoice,
} from './model'
import { loadDraft, loadInvoices, loadIssuer, saveDraft, saveInvoices, saveIssuer } from './storage'
import {
  bumpInvoiceNumber,
  formatDateJa,
  formatNumber,
  formatYen,
  newId,
  normalizeRegistrationNumber,
  parseNumberInput,
  sanitizeFileNamePart,
  todayIso,
} from './util'

type Child = Node | string | null | undefined

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const c of children) {
    if (c === null || c === undefined) continue
    node.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

function field(id: string, label: string, control: HTMLElement, wide = false): HTMLElement {
  return h('div', { class: wide ? 'field wide' : 'field' }, h('label', { for: id }, label), control)
}

function textInput(id: string, extra: Record<string, string> = {}): HTMLInputElement {
  return h('input', { type: 'text', id, autocomplete: 'off', ...extra })
}

const RATE_TEXT: Record<TaxRate, string> = { 10: '10%', 8: '8%（軽減）', 0: '非課税' }

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

let invoices: Invoice[] = loadInvoices()
let invoice: Invoice = loadDraft() ?? newInvoice(loadIssuer())

// ---------- フォームの組み立て ----------
const itemsBody = h('tbody', { id: 'items-body' })
const messageEl = h('div', { id: 'messages', class: 'messages', role: 'status' })
const checksEl = h('ul', { id: 'checks', class: 'checks' })
const savedListEl = h('ul', { id: 'saved-list', class: 'saved-list' })
const sheetWrap = h('div', { id: 'sheet-wrap' })
const importFile = h('input', { type: 'file', id: 'import-file', accept: 'application/json,.json', class: 'hidden' })

function selectEl(id: string, options: [string, string][]): HTMLSelectElement {
  const s = h('select', { id })
  for (const [value, label] of options) s.append(h('option', { value }, label))
  return s
}

const form = h(
  'form',
  { id: 'invoice-form', novalidate: '' },
  h(
    'section',
    { class: 'card' },
    h('h2', {}, '発行者（あなた）'),
    h(
      'div',
      { class: 'grid2' },
      field('issuerName', '氏名または名称', textInput('issuerName', { maxlength: '100' })),
      field(
        'issuerReg',
        '登録番号（T + 数字13桁）',
        textInput('issuerReg', { maxlength: '20', placeholder: 'T1234567890123' }),
      ),
      field('issuerAddress', '住所', h('textarea', { id: 'issuerAddress', rows: '2', maxlength: '300' }), true),
      field('issuerContact', '連絡先（電話・メール）', textInput('issuerContact', { maxlength: '200' }), true),
    ),
  ),
  h(
    'section',
    { class: 'card' },
    h('h2', {}, '請求先・請求書情報'),
    h(
      'div',
      { class: 'grid2' },
      field('clientName', '請求先の氏名または名称', textInput('clientName', { maxlength: '100' })),
      field('honorific', '敬称', selectEl('honorific', [['御中', '御中'], ['様', '様']])),
      field('invoiceNumber', '請求書番号', textInput('invoiceNumber', { maxlength: '40' })),
      field('issueDate', '発行日', h('input', { type: 'date', id: 'issueDate' })),
      field('dueDate', '支払期限（任意）', h('input', { type: 'date', id: 'dueDate' })),
    ),
  ),
  h(
    'section',
    { class: 'card' },
    h('h2', {}, '明細'),
    h(
      'div',
      { class: 'grid2' },
      field(
        'priceMode',
        '単価の入力方法',
        selectEl('priceMode', [['exclusive', '税抜で入力（消費税を加算）'], ['inclusive', '税込で入力（内税）']]),
      ),
      field(
        'rounding',
        '消費税の端数処理',
        selectEl('rounding', [['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']]),
      ),
    ),
    h(
      'div',
      { class: 'items-scroll' },
      h(
        'table',
        { class: 'items' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, '品名'),
            h('th', {}, '数量'),
            h('th', {}, '単価（円）'),
            h('th', {}, '税率'),
            h('th', {}, '金額'),
            h('th', {}, ''),
          ),
        ),
        itemsBody,
      ),
    ),
    h('div', { class: 'actions' }, h('button', { type: 'button', id: 'add-item', class: 'secondary' }, '＋ 明細を追加')),
    h(
      'div',
      { class: 'field wide with-gap' },
      h(
        'label',
        {},
        h('input', { type: 'checkbox', id: 'withholding' }),
        ' 源泉徴収を行う（報酬・料金に該当する場合のみ。税抜の報酬額に10.21%）',
      ),
    ),
  ),
  h(
    'section',
    { class: 'card' },
    h('h2', {}, '振込先・備考'),
    h(
      'div',
      { class: 'grid2' },
      field('bank', '振込先', h('textarea', { id: 'bank', rows: '3', maxlength: '300' }), true),
      field('notes', '備考', h('textarea', { id: 'notes', rows: '3', maxlength: '1000' }), true),
    ),
  ),
)

const mainCol = h(
  'div',
  { class: 'edit-col' },
  form,
  h('section', { class: 'card' }, h('h2', {}, '保存した請求書（このブラウザ内）'), savedListEl),
)

const previewCol = h(
  'div',
  { class: 'preview-col' },
  h(
    'section',
    { class: 'card' },
    h('h2', {}, '適格請求書の記載事項チェック'),
    checksEl,
    h('div', { class: 'actions' },
      h('button', { type: 'button', id: 'save-invoice' }, 'この請求書を保存'),
      h('button', { type: 'button', id: 'new-invoice', class: 'secondary' }, '新しい請求書'),
      h('button', { type: 'button', id: 'print', class: 'secondary' }, '印刷 / PDFで保存'),
    ),
    h('div', { class: 'actions' },
      h('button', { type: 'button', id: 'export-csv', class: 'secondary' }, 'CSVでダウンロード'),
      h('button', { type: 'button', id: 'export-json', class: 'secondary' }, 'バックアップ(JSON)を書き出す'),
      h('button', { type: 'button', id: 'import-json', class: 'secondary' }, 'バックアップ(JSON)を読み込む'),
      importFile,
    ),
    messageEl,
    h('p', { class: 'disclaimer' },
      'PDFにするには「印刷 / PDFで保存」を押し、送信先で「PDFに保存」を選んでください。',
      '本ツールの計算結果は一般的な目安です。税務上の判断は税理士・税務署等にご確認ください。',
    ),
  ),
  sheetWrap,
)

app.append(
  h('h1', {}, 'インボイス対応 請求書メーカー'),
  h('p', { class: 'subtitle' }, '税率ごとの端数処理と必須項目チェックに対応した請求書を、ブラウザだけで作成します。'),
  h('div', {},
    h('span', { class: 'badge' }, '登録不要'),
    h('span', { class: 'badge' }, '入力データは外部送信されません'),
    h('span', { class: 'badge' }, 'オフラインでも利用可能'),
  ),
  h('div', { class: 'layout' }, mainCol, previewCol),
)

// ---------- 値の反映 ----------
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} が見つかりません`)
  return node as T
}

function setMessage(text: string, kind: 'error' | 'info' | '' = ''): void {
  messageEl.textContent = text
  messageEl.className = `messages ${kind}`.trim()
}

function writeFormFromInvoice(): void {
  el<HTMLInputElement>('issuerName').value = invoice.issuer.name
  el<HTMLInputElement>('issuerReg').value = invoice.issuer.registrationNumber
  el<HTMLTextAreaElement>('issuerAddress').value = invoice.issuer.address
  el<HTMLInputElement>('issuerContact').value = invoice.issuer.contact
  el<HTMLInputElement>('clientName').value = invoice.clientName
  el<HTMLSelectElement>('honorific').value = invoice.honorific
  el<HTMLInputElement>('invoiceNumber').value = invoice.number
  el<HTMLInputElement>('issueDate').value = invoice.issueDate
  el<HTMLInputElement>('dueDate').value = invoice.dueDate
  el<HTMLSelectElement>('priceMode').value = invoice.options.priceMode
  el<HTMLSelectElement>('rounding').value = invoice.options.rounding
  el<HTMLInputElement>('withholding').checked = invoice.options.withholding
  el<HTMLTextAreaElement>('bank').value = invoice.bank
  el<HTMLTextAreaElement>('notes').value = invoice.notes
  renderItems()
}

function renderItems(): void {
  itemsBody.replaceChildren()
  invoice.items.forEach((it, idx) => {
    const rateSelect = h('select', { 'data-field': 'taxRate', 'aria-label': `明細${idx + 1}の税率` })
    for (const r of [10, 8, 0] as TaxRate[]) {
      rateSelect.append(h('option', { value: String(r) }, RATE_TEXT[r]))
    }
    rateSelect.value = String(it.taxRate)
    const tr = h(
      'tr',
      { 'data-idx': String(idx) },
      h('td', {}, h('input', { type: 'text', 'data-field': 'name', value: it.name, maxlength: '200', 'aria-label': `明細${idx + 1}の品名` })),
      h('td', {}, h('input', { type: 'text', inputmode: 'decimal', 'data-field': 'quantity', value: String(it.quantity), size: '5', 'aria-label': `明細${idx + 1}の数量` })),
      h('td', {}, h('input', { type: 'text', inputmode: 'numeric', 'data-field': 'unitPriceYen', value: String(it.unitPriceYen), size: '9', 'aria-label': `明細${idx + 1}の単価` })),
      h('td', {}, rateSelect),
      h('td', { class: 'amount', 'data-role': 'amount' }, ''),
      h('td', {}, h('button', { type: 'button', class: 'danger', 'data-action': 'remove', 'aria-label': `明細${idx + 1}を削除` }, '削除')),
    )
    itemsBody.append(tr)
  })
}

// ---------- プレビュー ----------
function numCell(text: string, cls = 'num'): HTMLElement {
  return h('td', { class: cls }, text)
}

function renderSheet(result: CalcResult): void {
  const inv = invoice
  const inclusive = inv.options.priceMode === 'inclusive'
  const reg = normalizeRegistrationNumber(inv.issuer.registrationNumber)

  const itemRows = inv.items.map((it, i) =>
    h('tr', {}, h('td', { class: 'name' }, it.name), numCell(formatNumber(it.quantity)), numCell(formatYen(it.unitPriceYen)),
      numCell(RATE_TEXT[it.taxRate], 'num'), numCell(formatYen(result.lineAmounts[i]))),
  )

  const groupRows = result.groups.map((g) =>
    h('tr', {}, h('td', {}, g.taxRate === 0 ? '非課税' : `${g.taxRate}%対象${g.taxRate === 8 ? '（軽減税率）' : ''}`),
      numCell(formatYen(g.subtotalYen)), numCell(formatYen(g.taxYen)), numCell(formatYen(g.totalYen))),
  )
  groupRows.push(
    h('tr', {}, h('th', {}, '合計'), numCell(formatYen(result.subtotalYen)), numCell(formatYen(result.taxYen)), numCell(formatYen(result.totalYen))),
  )

  const withholdingRows: HTMLElement[] = inv.options.withholding
    ? [
        h('tr', {}, h('td', { colspan: '3' }, '源泉徴収税額（復興特別所得税を含む）'), numCell(formatYen(-result.withholdingYen))),
        h('tr', {}, h('th', { colspan: '3' }, '差引請求額'), numCell(formatYen(result.payableYen))),
      ]
    : []

  const clientText = inv.clientName.trim() === '' ? '（請求先未入力）' : `${inv.clientName} ${inv.honorific}`

  const sheet = h(
    'div',
    { class: 'sheet', id: 'sheet' },
    h('h2', { class: 'doc-title' }, '請求書'),
    h(
      'div',
      { class: 'head' },
      h('div', {}, h('div', { class: 'client' }, clientText), h('p', { class: 'small' }, '下記のとおりご請求申し上げます。')),
      h('div', { class: 'meta' },
        h('div', {}, `請求書番号: ${inv.number}`),
        h('div', {}, `発行日: ${formatDateJa(inv.issueDate)}`),
        inv.dueDate ? h('div', {}, `支払期限: ${formatDateJa(inv.dueDate)}`) : null,
      ),
    ),
    h(
      'div',
      { class: 'issuer' },
      h('strong', {}, inv.issuer.name),
      '\n',
      reg !== '' ? `登録番号: ${reg}\n` : '',
      inv.issuer.address !== '' ? `${inv.issuer.address}\n` : '',
      inv.issuer.contact,
    ),
    h(
      'div',
      { class: 'total-box' },
      h('span', {}, inv.options.withholding ? '差引ご請求額' : 'ご請求金額（税込）'),
      h('span', { id: 'grand-total' }, formatYen(result.payableYen)),
    ),
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', {}, '数量'), h('th', {}, inclusive ? '単価（税込）' : '単価（税抜）'),
        h('th', {}, '税率'), h('th', {}, inclusive ? '金額（税込）' : '金額（税抜）'))),
      h('tbody', {}, ...itemRows),
    ),
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '税率区分'), h('th', {}, '対象額（税抜）'), h('th', {}, '消費税額'), h('th', {}, '税込合計'))),
      h('tbody', {}, ...groupRows, ...withholdingRows),
    ),
    inv.bank !== '' ? h('div', { class: 'block-title' }, '振込先') : null,
    inv.bank !== '' ? h('div', { class: 'pre' }, inv.bank) : null,
    inv.notes !== '' ? h('div', { class: 'block-title' }, '備考') : null,
    inv.notes !== '' ? h('div', { class: 'pre' }, inv.notes) : null,
  )
  sheetWrap.replaceChildren(sheet)
}

function currentResult(): CalcResult {
  return calculate(invoice.items, invoice.options)
}

function refresh(): void {
  const result = currentResult()
  itemsBody.querySelectorAll<HTMLElement>('tr').forEach((tr, i) => {
    const cell = tr.querySelector<HTMLElement>('[data-role="amount"]')
    if (cell) cell.textContent = formatYen(result.lineAmounts[i] ?? 0)
  })
  renderSheet(result)
  checksEl.replaceChildren(
    ...checkInvoice(invoice).map((c) =>
      h('li', { class: c.ok ? 'ok' : 'ng' }, c.label, !c.ok && c.hint ? h('div', { class: 'hint' }, c.hint) : null),
    ),
  )
  saveDraft(invoice)
}

function renderSavedList(): void {
  savedListEl.replaceChildren()
  if (invoices.length === 0) {
    savedListEl.append(h('li', {}, h('span', { class: 'title' }, 'まだ保存した請求書はありません。')))
    return
  }
  const sorted = [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const inv of sorted) {
    const total = calculate(inv.items, inv.options).payableYen
    savedListEl.append(
      h('li', { 'data-id': inv.id },
        h('span', { class: 'title' }, `${inv.number} ／ ${inv.clientName || '（請求先未入力）'} ／ ${formatYen(total)}`),
        h('button', { type: 'button', class: 'secondary', 'data-action': 'open' }, '開く'),
        h('button', { type: 'button', class: 'secondary', 'data-action': 'copy' }, '複製'),
        h('button', { type: 'button', class: 'danger', 'data-action': 'delete' }, '削除'),
      ),
    )
  }
}

// ---------- 入力イベント ----------
const NUM_ERROR_QTY = `数量は0以上${formatNumber(MAX_QUANTITY)}以下の数値で入力してください（小数は3桁まで）。`
const NUM_ERROR_PRICE = `単価は絶対値${MAX_UNIT_PRICE_YEN.toLocaleString('ja-JP')}以下の整数（円）で入力してください。値引きはマイナスで入力できます。`

function applyItemInput(target: HTMLInputElement | HTMLSelectElement, it: LineItem): void {
  const f = target.dataset.field
  if (f === 'name') {
    it.name = target.value
  } else if (f === 'taxRate') {
    it.taxRate = Number(target.value) as TaxRate
  } else if (f === 'quantity') {
    const n = parseNumberInput(target.value)
    if (Number.isNaN(n) || n < 0 || n > MAX_QUANTITY) {
      target.setAttribute('aria-invalid', 'true')
      setMessage(NUM_ERROR_QTY, 'error')
      return
    }
    target.removeAttribute('aria-invalid')
    it.quantity = Math.round(n * 1000) / 1000
    setMessage('')
  } else if (f === 'unitPriceYen') {
    const n = parseNumberInput(target.value)
    if (Number.isNaN(n) || !Number.isInteger(n) || Math.abs(n) > MAX_UNIT_PRICE_YEN) {
      target.setAttribute('aria-invalid', 'true')
      setMessage(NUM_ERROR_PRICE, 'error')
      return
    }
    target.removeAttribute('aria-invalid')
    it.unitPriceYen = n
    setMessage('')
  }
}

form.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  if (t.dataset.field) {
    const tr = t.closest('tr')
    const it = tr ? invoice.items[Number(tr.dataset.idx)] : undefined
    if (it) applyItemInput(t as HTMLInputElement | HTMLSelectElement, it)
  } else {
    switch (t.id) {
      case 'issuerName': invoice.issuer.name = t.value; break
      case 'issuerReg': invoice.issuer.registrationNumber = t.value; break
      case 'issuerAddress': invoice.issuer.address = t.value; break
      case 'issuerContact': invoice.issuer.contact = t.value; break
      case 'clientName': invoice.clientName = t.value; break
      case 'honorific': invoice.honorific = t.value === '様' ? '様' : '御中'; break
      case 'invoiceNumber': invoice.number = t.value; break
      case 'issueDate': invoice.issueDate = t.value; break
      case 'dueDate': invoice.dueDate = t.value; break
      case 'priceMode': invoice.options.priceMode = t.value as PriceMode; break
      case 'rounding': invoice.options.rounding = t.value as RoundingMode; break
      case 'withholding': invoice.options.withholding = (t as HTMLInputElement).checked; break
      case 'bank': invoice.bank = t.value; break
      case 'notes': invoice.notes = t.value; break
      default: return
    }
  }
  refresh()
})

// 入力欄を離れたとき、不正値のまま残っていれば直近の有効な値に戻す
form.addEventListener('focusout', (e) => {
  const t = e.target as HTMLInputElement
  if (t.getAttribute?.('aria-invalid') !== 'true') return
  const tr = t.closest('tr')
  const it = tr ? invoice.items[Number(tr.dataset.idx)] : undefined
  if (!it) return
  t.value = String(t.dataset.field === 'quantity' ? it.quantity : it.unitPriceYen)
  t.removeAttribute('aria-invalid')
  setMessage('')
})

form.addEventListener('submit', (e) => e.preventDefault())

form.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action="remove"]')
  if (!btn) return
  const tr = btn.closest('tr')
  if (!tr) return
  if (invoice.items.length <= 1) {
    setMessage('明細は最低1行必要です。', 'error')
    return
  }
  invoice.items.splice(Number(tr.dataset.idx), 1)
  renderItems()
  setMessage('')
  refresh()
})

el('add-item').addEventListener('click', () => {
  if (invoice.items.length >= MAX_ITEMS) {
    setMessage(`明細は最大${MAX_ITEMS}行までです。`, 'error')
    return
  }
  invoice.items.push(newItem())
  renderItems()
  setMessage('')
  refresh()
})

// ---------- 保存・読み込み ----------
function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadIntoEditor(next: Invoice): void {
  invoice = next
  writeFormFromInvoice()
  setMessage('')
  refresh()
}

el('save-invoice').addEventListener('click', () => {
  invoice.updatedAt = new Date().toISOString()
  const copy: Invoice = JSON.parse(JSON.stringify(invoice))
  const idx = invoices.findIndex((i) => i.id === copy.id)
  const next = [...invoices]
  if (idx >= 0) next[idx] = copy
  else next.push(copy)
  if (saveInvoices(next) && saveIssuer(copy.issuer)) {
    invoices = next
    renderSavedList()
    setMessage(`「${copy.number}」を保存しました（このブラウザ内のみ）。`, 'info')
  } else {
    setMessage('保存できませんでした（ブラウザの保存領域が使えない可能性があります）。JSONバックアップを書き出してください。', 'error')
  }
})

el('new-invoice').addEventListener('click', () => {
  loadIntoEditor(newInvoice(invoice.issuer, bumpInvoiceNumber(invoice.number)))
  setMessage('新しい請求書を作成しました。', 'info')
})

savedListEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-action]')
  const li = btn?.closest<HTMLElement>('li[data-id]')
  if (!btn || !li) return
  const target = invoices.find((i) => i.id === li.dataset.id)
  if (!target) return
  const action = btn.dataset.action
  if (action === 'open') {
    loadIntoEditor(JSON.parse(JSON.stringify(target)))
  } else if (action === 'copy') {
    const copy: Invoice = JSON.parse(JSON.stringify(target))
    copy.id = newId()
    copy.number = bumpInvoiceNumber(target.number)
    copy.issueDate = todayIso()
    copy.items = copy.items.map((it) => ({ ...it, id: newId() }))
    loadIntoEditor(copy)
    setMessage('複製しました（番号と発行日を更新しています）。保存すると一覧に追加されます。', 'info')
  } else if (action === 'delete') {
    if (!window.confirm(`「${target.number}」を削除します。よろしいですか？`)) return
    const next = invoices.filter((i) => i.id !== target.id)
    if (saveInvoices(next)) {
      invoices = next
      renderSavedList()
      setMessage('削除しました。', 'info')
    }
  }
})

el('print').addEventListener('click', () => {
  const prev = document.title
  document.title = `invoice-${sanitizeFileNamePart(invoice.number)}`
  try {
    window.print()
  } finally {
    document.title = prev
  }
})

el('export-csv').addEventListener('click', () => {
  download(buildInvoiceCsvBlob(invoice, currentResult()), csvDownloadFileName(invoice))
})

el('export-json').addEventListener('click', () => {
  download(backupToBlob(buildBackup(invoice.issuer, invoices)), jsonDownloadFileName(todayIso()))
  setMessage(`保存済みの請求書${invoices.length}件を書き出しました（保存していない編集中の内容は含まれません）。`, 'info')
})

el('import-json').addEventListener('click', () => importFile.click())

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  importFile.value = ''
  if (!file) return
  try {
    const backup = parseBackupText(await file.text())
    const map = new Map(invoices.map((i) => [i.id, i]))
    for (const inv of backup.invoices) map.set(inv.id, inv)
    const next = [...map.values()]
    if (!saveInvoices(next)) throw new Error('読み込んだデータを保存できませんでした。')
    invoices = next
    if (backup.issuer.name !== '' && invoice.issuer.name === '') {
      invoice.issuer = backup.issuer
      saveIssuer(backup.issuer)
      writeFormFromInvoice()
    }
    renderSavedList()
    refresh()
    setMessage(`${backup.invoices.length}件の請求書を読み込みました。`, 'info')
  } catch (err) {
    setMessage(err instanceof Error ? err.message : '読み込みに失敗しました。', 'error')
  }
})

// ---------- 起動 ----------
writeFormFromInvoice()
renderSavedList()
refresh()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service Worker が使えない環境でも通常機能は動作する
    })
  })
}
