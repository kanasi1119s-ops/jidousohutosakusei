import './style.css'
import { calcInvoice, TAX_RATES } from './calc'
import { buildInvoiceCsvBlob, csvDownloadFileName } from './csv'
import { h } from './dom'
import { formatDateJa, todayIso } from './format'
import { renderPreview } from './preview'
import {
  dataToJsonBlob,
  emptyAppData,
  jsonDownloadFileName,
  loadData,
  newId,
  newInvoice,
  newItem,
  parseDataFromJsonText,
  saveData,
} from './storage'
import type { AppData, Invoice, Issuer, LineItem, PriceMode, RoundingMode, TaxRate } from './types'
import { normalizeRegistrationNumber, validateInvoice } from './validate'

let data: AppData = loadData() ?? emptyAppData()

function persist(): void {
  data.draft.updatedAt = new Date().toISOString()
  saveData(data)
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toNumber(s: string): number {
  const v = Number(s.normalize('NFKC').replace(/,/g, '').trim())
  return s.trim() === '' || !Number.isFinite(v) ? NaN : v
}

// ---- フォーム部品 ----

type TextKey = 'invoiceNumber' | 'subject' | 'clientName' | 'notes' | 'issueDate' | 'transactionDate' | 'dueDate'
type IssuerKey = keyof Issuer

function labeled(label: string, control: HTMLElement, cls = ''): HTMLElement {
  return h('label', cls ? { class: cls } : {}, h('span', {}, label), control)
}

function textInput(id: string, value: string, onInput: (v: string) => void, type = 'text'): HTMLInputElement {
  const el = h('input', { id, type, autocomplete: 'off' })
  el.value = value
  el.addEventListener('input', () => onInput(el.value))
  return el
}

function textArea(id: string, value: string, onInput: (v: string) => void): HTMLTextAreaElement {
  const el = h('textarea', { id, rows: '3' })
  el.value = value
  el.addEventListener('input', () => onInput(el.value))
  return el
}

function selectEl<T extends string | number>(
  id: string,
  options: Array<[T, string]>,
  value: T,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const el = h('select', { id }, ...options.map(([v, l]) => h('option', { value: String(v) }, l)))
  el.value = String(value)
  el.addEventListener('change', () => onChange(el.value))
  return el
}

// ---- 画面 ----

const app = document.getElementById('app')!

const previewHost = h('div', { id: 'preview-host' })
const checkHost = h('div', { id: 'checklist' })
const messageHost = h('div', { id: 'messages', role: 'alert' })
const savedHost = h('div', { id: 'saved-list' })
const itemsHost = h('div', { id: 'items' })
const statusHost = h('p', { id: 'status', role: 'status' })

function refresh(): void {
  const inv = data.draft
  const totals = calcInvoice(inv)
  const v = validateInvoice(inv, totals.gross)

  previewHost.replaceChildren(renderPreview(inv, totals))

  messageHost.replaceChildren(
    ...v.errors.map((e) => h('p', { class: 'error' }, e)),
    ...v.warnings.map((w) => h('p', { class: 'warn' }, w)),
  )

  checkHost.replaceChildren(
    h('p', { class: v.isQualified ? 'ok-title' : 'ng-title' }, v.isQualified ? '適格請求書の記載事項: すべて満たしています' : '適格請求書の記載事項: 未入力の項目があります'),
    h('ul', {}, ...v.checklist.map((c) => h('li', { class: c.ok ? 'ok' : 'ng' }, (c.ok ? '✓ ' : '✗ ') + c.label))),
  )
  persist()
}

function setStatus(msg: string): void {
  statusHost.textContent = msg
}

function textField(id: string, label: string, key: TextKey, type = 'text'): HTMLElement {
  return labeled(label, textInput(id, data.draft[key], (v) => { data.draft[key] = v; refresh() }, type))
}

function issuerField(id: string, label: string, key: IssuerKey, multiline = false): HTMLElement {
  const onInput = (v: string) => {
    const value = key === 'registrationNumber' ? normalizeRegistrationNumber(v) : v
    data.draft.issuer[key] = value
    data.defaultIssuer = { ...data.draft.issuer }
    refresh()
  }
  const control = multiline ? textArea(id, data.draft.issuer[key], onInput) : textInput(id, data.draft.issuer[key], onInput)
  return labeled(label, control)
}

function itemRow(it: LineItem, index: number): HTMLElement {
  const n = index + 1
  const update = () => refresh()
  const name = textInput(`item-name-${index}`, it.name, (v) => { it.name = v; update() })
  name.setAttribute('aria-label', `明細${n} 品名`)
  const qty = textInput(`item-qty-${index}`, String(it.quantity), (v) => { it.quantity = toNumber(v); update() })
  qty.setAttribute('inputmode', 'decimal')
  qty.setAttribute('aria-label', `明細${n} 数量`)
  const price = textInput(`item-price-${index}`, String(it.unitPrice), (v) => { it.unitPrice = toNumber(v); update() })
  price.setAttribute('inputmode', 'decimal')
  price.setAttribute('aria-label', `明細${n} 単価`)
  const rate = selectEl<TaxRate>(
    `item-rate-${index}`,
    TAX_RATES.map((r) => [r, r === 0 ? '非課税等' : r === 8 ? '8%（軽減）' : '10%'] as [TaxRate, string]),
    it.taxRate,
    (v) => { it.taxRate = Number(v) as TaxRate; update() },
  )
  rate.setAttribute('aria-label', `明細${n} 税率`)
  const del = h('button', { type: 'button', class: 'secondary small', 'aria-label': `明細${n}を削除` }, '削除')
  del.addEventListener('click', () => {
    data.draft.items.splice(index, 1)
    if (data.draft.items.length === 0) data.draft.items.push(newItem())
    renderItems()
    refresh()
  })
  return h(
    'div',
    { class: 'item-row' },
    labeled('品名', name, 'item-name'),
    labeled('数量', qty),
    labeled('単価（円）', price),
    labeled('税率', rate),
    del,
  )
}

function renderItems(): void {
  itemsHost.replaceChildren(...data.draft.items.map(itemRow))
}

function renderSaved(): void {
  if (data.saved.length === 0) {
    savedHost.replaceChildren(h('p', { class: 'hint' }, 'まだ保存した請求書はありません。'))
    return
  }
  const rows = data.saved
    .slice()
    .reverse()
    .map((s) => {
      const load = h('button', { type: 'button', class: 'secondary small' }, '読み込む')
      load.addEventListener('click', () => {
        data.draft = { ...structuredClone(s), id: newId() }
        rebuild()
        setStatus('保存済みの請求書を複製して読み込みました。')
      })
      const del = h('button', { type: 'button', class: 'secondary small' }, '削除')
      del.addEventListener('click', () => {
        data.saved = data.saved.filter((x) => x.id !== s.id)
        saveData(data)
        renderSaved()
      })
      const t = calcInvoice(s)
      return h(
        'li',
        {},
        h('span', {}, `${s.invoiceNumber || '(番号なし)'} / ${s.clientName || '(請求先なし)'} / ${formatDateJa(s.issueDate)} / 合計 ${t.payable.toLocaleString('en-US')}円`),
        load,
        del,
      )
    })
  savedHost.replaceChildren(h('ul', { class: 'saved' }, ...rows))
}

function fileButton(id: string, label: string, onFile: (text: string) => void): HTMLElement {
  const input = h('input', { id, type: 'file', accept: 'application/json,.json', class: 'visually-hidden' })
  input.addEventListener('change', async () => {
    const f = input.files?.[0]
    if (!f) return
    try {
      onFile(await f.text())
    } catch (e) {
      setStatus(e instanceof Error && e.message !== '' ? e.message : 'ファイルを読み込めませんでした。')
    }
    input.value = ''
  })
  return h('label', { class: 'button secondary', for: id }, label, input)
}

function build(): HTMLElement {
  const inv = data.draft

  const clientSection = h(
    'section',
    {},
    h('h2', {}, '請求先・基本情報'),
    h(
      'div',
      { class: 'grid' },
      labeled('請求先名', textInput('clientName', inv.clientName, (v) => { inv.clientName = v; refresh() })),
      labeled('敬称', selectEl<string>('honorific', [['御中', '御中'], ['様', '様']], inv.honorific, (v) => { inv.honorific = v as Invoice['honorific']; refresh() })),
      textField('invoiceNumber', '請求書番号', 'invoiceNumber'),
      textField('subject', '件名', 'subject'),
      textField('issueDate', '発行日', 'issueDate', 'date'),
      textField('transactionDate', '取引日（納品日など）', 'transactionDate', 'date'),
      textField('dueDate', 'お支払期限', 'dueDate', 'date'),
    ),
  )

  const issuerSection = h(
    'section',
    {},
    h('h2', {}, '発行者情報（このブラウザに保存されます）'),
    h(
      'div',
      { class: 'grid' },
      issuerField('issuer-name', '氏名または名称', 'name'),
      issuerField('issuer-reg', '登録番号（T+13桁）', 'registrationNumber'),
      issuerField('issuer-postal', '郵便番号', 'postalCode'),
      issuerField('issuer-address', '住所', 'address'),
      issuerField('issuer-phone', '電話番号', 'phone'),
      issuerField('issuer-email', 'メールアドレス', 'email'),
      issuerField('issuer-bank', 'お振込先', 'bankInfo', true),
    ),
  )

  const addItem = h('button', { type: 'button', class: 'secondary', id: 'add-item' }, '明細を追加')
  addItem.addEventListener('click', () => {
    data.draft.items.push(newItem())
    renderItems()
    refresh()
  })

  const withholding = h('input', { id: 'withholding', type: 'checkbox' })
  withholding.checked = inv.withholdingEnabled
  withholding.addEventListener('change', () => { inv.withholdingEnabled = withholding.checked; refresh() })

  const itemsSection = h(
    'section',
    {},
    h('h2', {}, '明細'),
    h(
      'div',
      { class: 'grid' },
      labeled('金額の入力方法', selectEl<PriceMode>('priceMode', [['exclusive', '税抜で入力'], ['inclusive', '税込で入力']], inv.priceMode, (v) => { inv.priceMode = v as PriceMode; refresh() })),
      labeled('端数処理（税率ごとに1回）', selectEl<RoundingMode>('rounding', [['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']], inv.rounding, (v) => { inv.rounding = v as RoundingMode; refresh() })),
    ),
    itemsHost,
    addItem,
    h('label', { class: 'check' }, withholding, h('span', {}, '源泉徴収を行う（報酬・料金等。復興特別所得税を含む10.21%）')),
    labeled('備考', textArea('notes', inv.notes, (v) => { inv.notes = v; refresh() })),
  )

  const saveBtn = h('button', { type: 'button', id: 'save-invoice' }, 'この請求書を保存')
  saveBtn.addEventListener('click', () => {
    const copy = structuredClone(data.draft)
    const idx = data.saved.findIndex((s) => s.id === copy.id)
    if (idx >= 0) data.saved[idx] = copy
    else data.saved.push(copy)
    saveData(data)
    renderSaved()
    setStatus('保存しました（このブラウザ内のみ）。')
  })
  const newBtn = h('button', { type: 'button', class: 'secondary', id: 'new-invoice' }, '新しい請求書')
  newBtn.addEventListener('click', () => {
    data.draft = newInvoice(data.defaultIssuer)
    rebuild()
    setStatus('新しい請求書を作成しました（発行者情報は引き継ぎます）。')
  })
  const printBtn = h('button', { type: 'button', id: 'print' }, 'PDFとして保存／印刷')
  printBtn.addEventListener('click', () => window.print())
  const csvBtn = h('button', { type: 'button', class: 'secondary', id: 'export-csv' }, 'CSVを出力')
  csvBtn.addEventListener('click', () => download(buildInvoiceCsvBlob(data.draft), csvDownloadFileName(data.draft)))
  const jsonBtn = h('button', { type: 'button', class: 'secondary', id: 'export-json' }, '全データをバックアップ（JSON）')
  jsonBtn.addEventListener('click', () => download(dataToJsonBlob(data), jsonDownloadFileName(todayIso())))
  const importBtn = fileButton('import-json', 'バックアップを読み込む', (text) => {
    const next = parseDataFromJsonText(text)
    data = next
    rebuild()
    setStatus('バックアップを読み込みました。')
  })

  const actions = h('div', { class: 'actions' }, printBtn, saveBtn, newBtn, csvBtn, jsonBtn, importBtn)

  return h(
    'div',
    { class: 'layout' },
    h(
      'div',
      { class: 'form no-print' },
      clientSection,
      issuerSection,
      itemsSection,
      h('section', {}, h('h2', {}, '入力チェック'), messageHost, checkHost),
      h('section', {}, h('h2', {}, '保存済みの請求書'), savedHost),
    ),
    h('div', { class: 'right' }, h('div', { class: 'actions no-print' }, actions, statusHost), previewHost),
  )
}

function rebuild(): void {
  app.replaceChildren(
    h(
      'header',
      { class: 'no-print' },
      h('h1', {}, '適格請求書ジェネレーター'),
      h('p', { class: 'lead' }, '登録不要・オフラインでも使える請求書作成ツール。入力内容はこのブラウザの外には送信されません。'),
    ),
    build(),
    h(
      'footer',
      { class: 'no-print' },
      h('p', {}, '本ツールは請求書作成の補助を目的としたもので、税務・法律上の助言ではありません。記載内容と税額は、ご自身（必要に応じて税理士等）の責任で確認してください。'),
      h('p', {}, '消費税の端数処理は適格請求書1枚につき税率ごとに1回です。源泉徴収税額は国税庁の定める算式（100万円以下10.21%、超過分20.42%、1円未満切捨て）に基づく目安です。'),
      h('p', {}, 'データはブラウザ（localStorage）にのみ保存されます。ブラウザのデータ消去で失われるため、「全データをバックアップ」を定期的にご利用ください。'),
    ),
  )
  renderItems()
  renderSaved()
  refresh()
}

rebuild()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗してもオンラインでの利用には影響しない
    })
  })
}

