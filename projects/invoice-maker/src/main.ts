import './style.css'
import {
  calculateInvoice,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumberInput,
  type LineItem,
  type TaxRate,
} from './calc'
import { buildInvoiceCsvBlob, csvDownloadFileName, safeFileName } from './csv'
import {
  dataToJsonBlob,
  loadData,
  nextInvoiceNumber,
  parseDataFromJsonText,
  saveData,
  type AppData,
  type Invoice,
} from './storage'

const $ = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id)
  if (!e) throw new Error(`#${id} not found`)
  return e as T
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

export function formatYen(n: number): string {
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (n < 0 ? '-¥' : '¥') + s
}

export function formatDateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

let data: AppData = loadData()
let draft: Invoice = newDraft()
// 保存済み（または開いた直後）の状態。これと異なれば未保存の変更あり
let savedSnapshot = snapshotOf(draft)

function snapshotOf(inv: Invoice): string {
  return JSON.stringify({ ...inv, updatedAt: '' })
}

function isDirty(): boolean {
  return snapshotOf(draft) !== savedSnapshot
}

function newDraft(): Invoice {
  const today = todayIso()
  return {
    id: newId(),
    number: nextInvoiceNumber(today, data.invoices.map((x) => x.number)),
    issueDate: today,
    dueDate: '',
    customerName: '',
    subject: '',
    notes: '',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    updatedAt: '',
  }
}

function setMessage(text: string, isError = false): void {
  const m = $('message')
  m.textContent = text
  m.className = 'message' + (isError ? ' error' : '')
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- プレビュー ----------
function td(text: string, className?: string): HTMLTableCellElement {
  return el('td', className, text)
}

function renderPreview(): void {
  const box = $('preview')
  box.replaceChildren()
  const iss = data.issuer
  const result = calculateInvoice(draft)
  const regOk = isValidRegistrationNumber(iss.registrationNumber)

  box.appendChild(el('h2', undefined, '請求書'))

  const head = el('div', 'doc-head')
  const left = el('div')
  const cust = el('p', 'customer', (draft.customerName || '（請求先名）') + ' 御中')
  left.appendChild(cust)
  if (draft.subject) left.appendChild(el('p', undefined, `件名: ${draft.subject}`))
  const right = el('div', 'right')
  right.appendChild(el('p', undefined, `請求書番号: ${draft.number}`))
  right.appendChild(el('p', undefined, `発行日: ${formatDateJa(draft.issueDate)}`))
  right.appendChild(el('p', undefined, iss.name || '（発行者名）'))
  if (iss.address) right.appendChild(el('p', undefined, iss.address))
  if (iss.registrationNumber) {
    right.appendChild(el('p', undefined, `登録番号: ${normalizeRegistrationNumber(iss.registrationNumber)}`))
  }
  if (iss.contact) right.appendChild(el('p', undefined, iss.contact))
  head.append(left, right)
  box.appendChild(head)

  if (!regOk) {
    box.appendChild(
      el(
        'p',
        'doc-warn no-print',
        '※ 登録番号が未入力、または形式（T + 数字13桁）が正しくありません。適格請求書として発行するには登録番号が必要です。',
      ),
    )
  }

  const totalBox = el('div', 'total-box')
  totalBox.append(el('span', undefined, 'ご請求金額（税込）'), el('span', undefined, formatYen(result.payable)))
  totalBox.querySelector('span:last-child')?.setAttribute('data-testid', 'payable')
  box.appendChild(totalBox)

  const wrap = el('div', 'table-wrap')
  const table = el('table', 'doc-table')
  const thead = el('thead')
  const htr = el('tr')
  const amountLabel = draft.priceMode === 'inclusive' ? '金額（税込）' : '金額（税抜）'
  for (const h of ['品目', '数量', '単価', '税率', amountLabel]) htr.appendChild(el('th', undefined, h))
  thead.appendChild(htr)
  table.appendChild(thead)
  const tbody = el('tbody')
  let hasReduced = false
  draft.items.forEach((it, i) => {
    const tr = el('tr')
    if (it.taxRate === 8) hasReduced = true
    const nameText = (it.name || '（品目）') + (it.taxRate === 8 ? ' ※' : '')
    tr.append(
      td(nameText),
      td(String(it.quantity), 'num'),
      td(formatYen(it.unitPrice), 'num'),
      td(it.taxRate === 0 ? '非課税' : `${it.taxRate}%`, 'num'),
      td(formatYen(result.lineAmounts[i]), 'num'),
    )
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  wrap.appendChild(table)
  box.appendChild(wrap)
  if (hasReduced) box.appendChild(el('p', 'doc-note', '※ は軽減税率（8%）対象品目です。'))

  const sWrap = el('div', 'table-wrap')
  const sTable = el('table', 'doc-table summary-table')
  const sBody = el('tbody')
  const row = (label: string, value: string, testId?: string): void => {
    const tr = el('tr')
    const v = td(value, 'num')
    if (testId) v.setAttribute('data-testid', testId)
    tr.append(el('th', undefined, label), v)
    sBody.appendChild(tr)
  }
  for (const s of result.summaries) {
    if (s.taxRate === 0) {
      row('非課税・不課税対象', formatYen(s.netTotal))
    } else {
      row(`${s.taxRate}%対象（税抜）`, formatYen(s.netTotal), `net-${s.taxRate}`)
      row(`消費税（${s.taxRate}%）`, formatYen(s.tax), `tax-${s.taxRate}`)
    }
  }
  row('税込合計', formatYen(result.grossTotal), 'gross')
  if (draft.withholding) row('源泉徴収税額', '-' + formatYen(result.withholdingTax), 'withholding')
  row('ご請求金額', formatYen(result.payable))
  sTable.appendChild(sBody)
  sWrap.appendChild(sTable)
  box.appendChild(sWrap)

  if (draft.dueDate) box.appendChild(el('p', undefined, `お支払期限: ${formatDateJa(draft.dueDate)}`))
  if (iss.bank) {
    box.appendChild(el('p', undefined, '振込先'))
    box.appendChild(el('p', 'doc-note', iss.bank))
  }
  if (draft.notes) {
    box.appendChild(el('p', undefined, '備考'))
    box.appendChild(el('p', 'doc-note', draft.notes))
  }
}

// ---------- フォーム ----------
function updateRegHint(): void {
  const hint = $('reg-hint')
  const v = $<HTMLInputElement>('issuer-reg').value
  if (!v.trim()) {
    hint.textContent = ''
    hint.className = 'hint'
  } else if (isValidRegistrationNumber(v)) {
    hint.textContent = '形式OK（登録の実在確認は国税庁の公表サイトで行ってください）'
    hint.className = 'hint ok'
  } else {
    hint.textContent = '形式が正しくありません（T + 数字13桁）'
    hint.className = 'hint ng'
  }
}

function renderItems(): void {
  const box = $('items')
  box.replaceChildren()
  draft.items.forEach((it, i) => {
    const row = el('div', 'item-row')
    row.setAttribute('data-testid', 'item-row')

    const name = el('input')
    name.type = 'text'
    name.className = 'wide'
    name.placeholder = '品目'
    name.setAttribute('aria-label', `品目 ${i + 1}`)
    name.value = it.name
    name.addEventListener('input', () => {
      draft.items[i].name = name.value.slice(0, 200)
      renderPreview()
    })

    const qty = el('input')
    qty.type = 'text'
    qty.inputMode = 'decimal'
    qty.placeholder = '数量'
    qty.setAttribute('aria-label', `数量 ${i + 1}`)
    qty.value = String(it.quantity)
    qty.addEventListener('input', () => {
      draft.items[i].quantity = parseNumberInput(qty.value, { max: 1_000_000 })
      renderPreview()
    })

    const price = el('input')
    price.type = 'text'
    price.inputMode = 'decimal'
    price.placeholder = '単価'
    price.setAttribute('aria-label', `単価 ${i + 1}`)
    price.value = String(it.unitPrice)
    price.addEventListener('input', () => {
      draft.items[i].unitPrice = parseNumberInput(price.value, { allowNegative: true })
      renderPreview()
    })

    const rate = el('select')
    rate.setAttribute('aria-label', `税率 ${i + 1}`)
    for (const [v, label] of [
      ['10', '10%'],
      ['8', '8%（軽減）'],
      ['0', '非課税・不課税'],
    ]) {
      const o = el('option', undefined, label)
      o.value = v
      rate.appendChild(o)
    }
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => {
      draft.items[i].taxRate = Number(rate.value) as TaxRate
      renderPreview()
    })

    const del = el('button', 'danger', '削除')
    del.type = 'button'
    del.setAttribute('aria-label', `明細 ${i + 1} を削除`)
    del.addEventListener('click', () => {
      draft.items.splice(i, 1)
      if (draft.items.length === 0) draft.items.push(blankItem())
      renderItems()
      renderPreview()
    })

    row.append(name, qty, price, rate, del)
    box.appendChild(row)
  })
}

function blankItem(): LineItem {
  return { name: '', quantity: 1, unitPrice: 0, taxRate: 10 }
}

function fillFormFromDraft(): void {
  $<HTMLInputElement>('customer-name').value = draft.customerName
  $<HTMLInputElement>('subject').value = draft.subject
  $<HTMLInputElement>('invoice-number').value = draft.number
  $<HTMLInputElement>('issue-date').value = draft.issueDate
  $<HTMLInputElement>('due-date').value = draft.dueDate
  $<HTMLTextAreaElement>('notes').value = draft.notes
  $<HTMLSelectElement>('price-mode').value = draft.priceMode
  $<HTMLSelectElement>('rounding').value = draft.rounding
  $<HTMLInputElement>('withholding').checked = draft.withholding
  renderItems()
}

function fillIssuerForm(): void {
  const i = data.issuer
  $<HTMLInputElement>('issuer-name').value = i.name
  $<HTMLInputElement>('issuer-address').value = i.address
  $<HTMLInputElement>('issuer-reg').value = i.registrationNumber
  $<HTMLInputElement>('issuer-contact').value = i.contact
  $<HTMLTextAreaElement>('issuer-bank').value = i.bank
  updateRegHint()
}

function bindIssuer(): void {
  const map: Array<[string, keyof AppData['issuer']]> = [
    ['issuer-name', 'name'],
    ['issuer-address', 'address'],
    ['issuer-reg', 'registrationNumber'],
    ['issuer-contact', 'contact'],
    ['issuer-bank', 'bank'],
  ]
  for (const [id, key] of map) {
    const input = $<HTMLInputElement | HTMLTextAreaElement>(id)
    input.addEventListener('input', () => {
      data.issuer[key] = input.value
      saveData(data)
      if (key === 'registrationNumber') updateRegHint()
      renderPreview()
    })
  }
}

function bindDraft(): void {
  const text: Array<[string, 'customerName' | 'subject' | 'number' | 'issueDate' | 'dueDate' | 'notes']> = [
    ['customer-name', 'customerName'],
    ['subject', 'subject'],
    ['invoice-number', 'number'],
    ['issue-date', 'issueDate'],
    ['due-date', 'dueDate'],
    ['notes', 'notes'],
  ]
  for (const [id, key] of text) {
    const input = $<HTMLInputElement | HTMLTextAreaElement>(id)
    input.addEventListener('input', () => {
      draft[key] = input.value
      renderPreview()
    })
  }
  $<HTMLSelectElement>('price-mode').addEventListener('change', (e) => {
    draft.priceMode = (e.target as HTMLSelectElement).value === 'inclusive' ? 'inclusive' : 'exclusive'
    renderPreview()
  })
  $<HTMLSelectElement>('rounding').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value
    draft.rounding = v === 'round' || v === 'ceil' ? v : 'floor'
    renderPreview()
  })
  $<HTMLInputElement>('withholding').addEventListener('change', (e) => {
    draft.withholding = (e.target as HTMLInputElement).checked
    renderPreview()
  })
  $('add-item').addEventListener('click', () => {
    if (draft.items.length >= 200) return setMessage('明細は200行までです。', true)
    draft.items.push(blankItem())
    renderItems()
    renderPreview()
  })
}

// ---------- 保存・出力 ----------
function renderSavedList(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (data.invoices.length === 0) {
    ul.appendChild(el('li', undefined, 'まだ保存された請求書はありません。'))
    return
  }
  for (const inv of data.invoices) {
    const li = el('li')
    li.setAttribute('data-testid', 'saved-item')
    const label = el('span', 'label', `${inv.number} / ${inv.customerName || '（請求先未入力）'}`)
    const open = el('button', 'secondary', '開く')
    open.type = 'button'
    open.addEventListener('click', () => {
      if (isDirty() && !window.confirm('保存していない変更があります。破棄してこの請求書を開きますか？')) return
      draft = JSON.parse(JSON.stringify(inv)) as Invoice
      savedSnapshot = snapshotOf(draft)
      fillFormFromDraft()
      renderPreview()
      setMessage(`${inv.number} を開きました。`)
    })
    const del = el('button', 'danger', '削除')
    del.type = 'button'
    del.addEventListener('click', () => {
      if (!window.confirm(`${inv.number} を削除しますか？`)) return
      data.invoices = data.invoices.filter((x) => x.id !== inv.id)
      saveData(data)
      renderSavedList()
      setMessage('削除しました。')
    })
    li.append(label, open, del)
    ul.appendChild(li)
  }
}

function bindActions(): void {
  $('save-invoice').addEventListener('click', () => {
    draft.updatedAt = new Date().toISOString()
    const copy = JSON.parse(JSON.stringify(draft)) as Invoice
    const idx = data.invoices.findIndex((x) => x.id === copy.id)
    if (idx >= 0) data.invoices[idx] = copy
    else data.invoices.push(copy)
    saveData(data)
    savedSnapshot = snapshotOf(draft)
    renderSavedList()
    setMessage('保存しました（このブラウザ内のみに保存されます）。')
  })
  $('new-invoice').addEventListener('click', () => {
    if (isDirty() && !window.confirm('保存していない変更があります。破棄して新しい請求書を作成しますか？')) return
    draft = newDraft()
    savedSnapshot = snapshotOf(draft)
    fillFormFromDraft()
    renderPreview()
    setMessage('新しい請求書を作成しました。')
  })
  $('print').addEventListener('click', () => window.print())
  $('download-csv').addEventListener('click', () => {
    const result = calculateInvoice(draft)
    download(buildInvoiceCsvBlob(draft, result), csvDownloadFileName(draft.number))
  })
  $('export-json').addEventListener('click', () => {
    download(dataToJsonBlob(data), safeFileName(`invoice-maker-backup-${todayIso()}`, 'json'))
  })
  $<HTMLInputElement>('import-json').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const imported = parseDataFromJsonText(await file.text())
      const byId = new Map(data.invoices.map((x) => [x.id, x]))
      for (const inv of imported.invoices) byId.set(inv.id, inv)
      data.invoices = Array.from(byId.values())
      if (imported.issuer.name || imported.issuer.registrationNumber) data.issuer = imported.issuer
      saveData(data)
      fillIssuerForm()
      renderSavedList()
      renderPreview()
      setMessage(`バックアップを読み込みました（請求書 ${imported.invoices.length} 件）。`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '読み込みに失敗しました。', true)
    } finally {
      input.value = ''
    }
  })
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗してもアプリ本体は動作する
    })
  }
}

function init(): void {
  fillIssuerForm()
  fillFormFromDraft()
  bindIssuer()
  bindDraft()
  bindActions()
  renderSavedList()
  renderPreview()
  registerServiceWorker()
}

init()
