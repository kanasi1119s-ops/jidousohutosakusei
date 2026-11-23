import './style.css'
import { calcInvoice, formatYen, isValidRegistrationNumber, lineAmount, type Invoice, type Item, type Rounding, type TaxMode, type TaxRate } from './calc'
import { backupFileName, buildInvoicesCsv, csvFileName } from './csv'
import { normalizeRegNo, parseNumberInput } from './normalize'
import { loadData, newId, parseImport, saveData, type AppData } from './storage'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

/** innerHTML を使わず、textContent 経由でのみ文字列を挿入する小さなDOMビルダー（XSS対策） */
function h(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

let data: AppData = loadData()
let current: Invoice | null = null

const persist = (msgEl: HTMLElement): void => {
  msgEl.textContent = saveData(data) ? '' : '保存に失敗しました（ブラウザの保存領域が使えません）。バックアップ(JSON)を保存してください。'
}

function download(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = h('a', { href: url, download: filename }) as HTMLAnchorElement
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fmtDate = (s: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

// ---------- 発行者情報 ----------
const issuerFields = ['name', 'regno', 'address', 'tel', 'bank'] as const
function loadIssuerForm(): void {
  const i = data.issuer
  $<HTMLInputElement>('issuer-name').value = i.name
  $<HTMLInputElement>('issuer-regno').value = i.regNo
  $<HTMLInputElement>('issuer-address').value = i.address
  $<HTMLInputElement>('issuer-tel').value = i.tel
  $<HTMLTextAreaElement>('issuer-bank').value = i.bank
}
function onIssuerInput(): void {
  const regNo = normalizeRegNo($<HTMLInputElement>('issuer-regno').value)
  data.issuer = {
    name: $<HTMLInputElement>('issuer-name').value.trim(),
    regNo,
    address: $<HTMLInputElement>('issuer-address').value.trim(),
    tel: $<HTMLInputElement>('issuer-tel').value.trim(),
    bank: $<HTMLTextAreaElement>('issuer-bank').value.trim(),
  }
  persist($('issuer-msg'))
  if (regNo && !isValidRegistrationNumber(regNo)) $('issuer-msg').textContent = '登録番号は「T＋数字13桁」の形式で入力してください。'
  renderSheet()
}
for (const f of issuerFields) $(`issuer-${f}`).addEventListener('input', onIssuerInput)

// ---------- 一覧 ----------
function renderList(): void {
  const body = $('list-body')
  body.replaceChildren()
  if (data.invoices.length === 0) {
    body.append(h('tr', {}, h('td', { colspan: '5' }, 'まだ請求書がありません。「新しい請求書を作る」から作成できます。')))
    return
  }
  for (const inv of data.invoices) {
    const total = calcInvoice(inv).grandTotal
    const mk = (label: string, fn: () => void) => {
      const b = h('button', { type: 'button' }, label)
      b.addEventListener('click', fn)
      return b
    }
    body.append(
      h('tr', {}, h('td', {}, inv.number || '(番号なし)'), h('td', {}, fmtDate(inv.issueDate)), h('td', {}, inv.customer), h('td', { class: 'num' }, formatYen(total)),
        h('td', { class: 'ops' },
          mk('編集', () => openEditor(inv)),
          mk('複製', () => duplicate(inv)),
          mk('削除', () => remove(inv)),
        )),
    )
  }
}

function nextNumber(): string {
  const d = new Date()
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${ym}-${String(data.invoices.length + 1).padStart(3, '0')}`
}
const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const blankItem = (): Item => ({ name: '', qty: 1, unitPrice: 0, rate: 10 })

function duplicate(inv: Invoice): void {
  const copy: Invoice = { ...structuredClone(inv), id: newId(), number: nextNumber(), issueDate: today() }
  data.invoices.push(copy)
  persist($('list-msg'))
  renderList()
}
function remove(inv: Invoice): void {
  if (!window.confirm(`請求書「${inv.number}」を削除します。よろしいですか？`)) return
  data.invoices = data.invoices.filter((x) => x.id !== inv.id)
  if (current?.id === inv.id) closeEditor()
  persist($('list-msg'))
  renderList()
}

$('btn-new').addEventListener('click', () => {
  openEditor({ id: newId(), number: nextNumber(), customer: '', issueDate: today(), dueDate: '', taxMode: 'exclusive', rounding: 'floor', items: [blankItem()], note: '' }, true)
})
$('btn-csv').addEventListener('click', () => {
  download(buildInvoicesCsv(data.invoices), 'text/csv;charset=utf-8', csvFileName())
})
$('btn-backup').addEventListener('click', () => {
  download(JSON.stringify(data, null, 2), 'application/json;charset=utf-8', backupFileName())
})
$<HTMLInputElement>('file-import').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const parsed = parseImport(await file.text())
  if (!parsed) {
    $('list-msg').textContent = '読み込めませんでした。このツールで保存したバックアップ(JSON)を選んでください。'
    return
  }
  if (!window.confirm(`現在のデータを置き換えて、バックアップの内容（請求書${parsed.invoices.length}件）を読み込みます。よろしいですか？`)) return
  data = parsed
  closeEditor()
  loadIssuerForm()
  persist($('list-msg'))
  if (!$('list-msg').textContent) $('list-msg').textContent = `バックアップを読み込みました（請求書${parsed.invoices.length}件）。`
  renderList()
})

// ---------- 編集 ----------
function openEditor(inv: Invoice, isNew = false): void {
  current = structuredClone(inv)
  ;(current as Invoice & { _new?: boolean })._new = isNew
  $('editor').hidden = false
  $<HTMLInputElement>('inv-number').value = current.number
  $<HTMLInputElement>('inv-customer').value = current.customer
  $<HTMLInputElement>('inv-issue').value = current.issueDate
  $<HTMLInputElement>('inv-due').value = current.dueDate
  $<HTMLSelectElement>('inv-taxmode').value = current.taxMode
  $<HTMLSelectElement>('inv-rounding').value = current.rounding
  $<HTMLTextAreaElement>('inv-note').value = current.note
  $('edit-errors').textContent = ''
  renderItems()
  refresh()
  $('editor').scrollIntoView?.()
}
function closeEditor(): void {
  current = null
  $('editor').hidden = true
  $('sheet-wrap').hidden = true
}

function renderItems(): void {
  if (!current) return
  const body = $('items-body')
  body.replaceChildren()
  const cur: Invoice = current
  cur.items.forEach((item, idx) => {
    const name = h('input', { 'aria-label': `品名${idx + 1}`, class: 'in-name' }) as HTMLInputElement
    const qty = h('input', { 'aria-label': `数量${idx + 1}`, class: 'in-qty', inputmode: 'decimal' }) as HTMLInputElement
    const price = h('input', { 'aria-label': `単価${idx + 1}`, class: 'in-price', inputmode: 'decimal' }) as HTMLInputElement
    const rate = h('select', { 'aria-label': `税率${idx + 1}`, class: 'in-rate' }, h('option', { value: '10' }, '10%'), h('option', { value: '8' }, '8%（軽減）')) as HTMLSelectElement
    name.value = item.name
    qty.value = String(item.qty)
    price.value = String(item.unitPrice)
    rate.value = String(item.rate)
    const amount = h('td', { class: 'num amount' })
    const del = h('button', { type: 'button', 'aria-label': `明細${idx + 1}を削除` }, '削除')
    const sync = (): void => {
      if (!current) return
      const q = parseNumberInput(qty.value)
      const p = parseNumberInput(price.value)
      item.name = name.value
      item.qty = Number.isFinite(q) ? q : 0
      item.unitPrice = Number.isFinite(p) ? p : 0
      item.rate = Number(rate.value) as TaxRate
      qty.classList.toggle('bad', !Number.isFinite(q))
      price.classList.toggle('bad', !Number.isFinite(p))
      amount.textContent = formatYen(lineAmount(item, current.rounding))
      refresh()
    }
    for (const el of [name, qty, price, rate]) el.addEventListener('input', sync)
    del.addEventListener('click', () => {
      if (!current) return
      current.items.splice(idx, 1)
      renderItems()
      refresh()
    })
    amount.textContent = formatYen(lineAmount(item, cur.rounding))
    body.append(h('tr', {}, h('td', {}, name), h('td', {}, qty), h('td', {}, price), h('td', {}, rate), amount, h('td', {}, del)))
  })
}
$('btn-add-item').addEventListener('click', () => {
  if (!current) return
  current.items.push(blankItem())
  renderItems()
  refresh()
})
const headerBind: [string, (c: Invoice, v: string) => void][] = [
  ['inv-number', (c, v) => (c.number = v.trim())],
  ['inv-customer', (c, v) => (c.customer = v.trim())],
  ['inv-issue', (c, v) => (c.issueDate = v)],
  ['inv-due', (c, v) => (c.dueDate = v)],
  ['inv-taxmode', (c, v) => (c.taxMode = v as TaxMode)],
  ['inv-rounding', (c, v) => (c.rounding = v as Rounding)],
  ['inv-note', (c, v) => (c.note = v)],
]
for (const [id, fn] of headerBind) {
  $(id).addEventListener('input', () => {
    if (!current) return
    fn(current, ($(id) as HTMLInputElement).value)
    if (id === 'inv-rounding') renderItems()
    refresh()
  })
}

function refresh(): void {
  if (!current) return
  const t = calcInvoice(current)
  const totals = $('totals')
  totals.replaceChildren()
  for (const g of t.groups) {
    totals.append(h('div', {}, `${g.rate}%対象: 税抜 ${formatYen(g.subtotalExcl)} ／ 消費税 ${formatYen(g.tax)}`))
  }
  totals.append(h('div', { class: 'grand' }, `合計（税込）: ${formatYen(t.grandTotal)}`))
  renderSheet()
}

function validate(): string[] {
  const errs: string[] = []
  if (!current) return errs
  if (!current.number) errs.push('請求書番号を入力してください。')
  if (!current.customer) errs.push('宛先を入力してください。')
  if (!current.issueDate) errs.push('発行日を入力してください。')
  if (current.items.length === 0) errs.push('明細を1行以上入力してください。')
  if (current.items.some((i) => !i.name.trim())) errs.push('品名が空の明細があります。')
  return errs
}

$('btn-save').addEventListener('click', () => {
  if (!current) return
  const errs = validate()
  $('edit-errors').textContent = errs.join(' ')
  if (errs.length) return
  const { _new, ...clean } = current as Invoice & { _new?: boolean }
  void _new
  const idx = data.invoices.findIndex((x) => x.id === clean.id)
  if (idx >= 0) data.invoices[idx] = clean
  else data.invoices.push(clean)
  persist($('edit-errors'))
  if (!$('edit-errors').textContent) $('edit-errors').textContent = ''
  renderList()
  $('list-msg').textContent = `請求書「${clean.number}」を保存しました。`
})
$('btn-close').addEventListener('click', closeEditor)
$('btn-print').addEventListener('click', () => {
  const errs = validate()
  $('edit-errors').textContent = errs.join(' ')
  if (errs.length) return
  window.print()
})

// ---------- 請求書プレビュー（印刷対象） ----------
function renderSheet(): void {
  const wrap = $('sheet-wrap')
  if (!current) {
    wrap.hidden = true
    return
  }
  wrap.hidden = false
  const iss = data.issuer
  const cur: Invoice = current
  const t = calcInvoice(cur)
  const sheet = $('sheet')
  sheet.replaceChildren()
  const warn: string[] = []
  if (!iss.name) warn.push('発行者の氏名・名称が未入力です。')
  if (!isValidRegistrationNumber(iss.regNo)) warn.push('登録番号が未入力または形式不正のため、適格請求書の要件を満たしません。')
  $('sheet-warn').textContent = warn.join(' ')

  const hasReduced = current.items.some((i) => i.rate === 8)
  const rows = current.items.map((i) =>
    h('tr', {}, h('td', {}, i.name + (i.rate === 8 ? ' ※' : '')), h('td', { class: 'num' }, String(i.qty)), h('td', { class: 'num' }, formatYen(i.unitPrice)), h('td', { class: 'num' }, `${i.rate}%`), h('td', { class: 'num' }, formatYen(lineAmount(i, cur.rounding)))),
  )
  sheet.append(
    h('h2', { class: 'sheet-title' }, '請求書'),
    h('div', { class: 'sheet-head' },
      h('div', {}, h('p', { class: 'cust' }, `${current.customer || '（宛先）'} 御中`), h('p', {}, '下記のとおりご請求申し上げます。'),
        h('p', { class: 'big' }, `ご請求金額（税込）: ${formatYen(t.grandTotal)}`),
        current.dueDate ? h('p', {}, `お支払期限: ${fmtDate(current.dueDate)}`) : ''),
      h('div', { class: 'issuer' },
        h('p', {}, `請求書番号: ${current.number}`), h('p', {}, `発行日: ${fmtDate(current.issueDate)}`),
        h('p', { class: 'iname' }, iss.name), h('p', {}, iss.regNo ? `登録番号: ${iss.regNo}` : ''),
        h('p', {}, iss.address), h('p', {}, iss.tel ? `TEL: ${iss.tel}` : ''))),
    h('table', { class: 'sheet-items' },
      h('thead', {}, h('tr', {}, ...['品名', '数量', current.taxMode === 'inclusive' ? '単価(税込)' : '単価(税抜)', '税率', '金額'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...rows)),
    hasReduced ? h('p', { class: 'small' }, '※は軽減税率（8%）対象です。') : '',
    h('table', { class: 'sheet-tax' },
      h('thead', {}, h('tr', {}, h('th', {}, '税率区分'), h('th', {}, '税抜金額'), h('th', {}, '消費税額'), h('th', {}, '税込金額'))),
      h('tbody', {}, ...t.groups.map((g) => h('tr', {}, h('td', {}, `${g.rate}%対象`), h('td', { class: 'num' }, formatYen(g.subtotalExcl)), h('td', { class: 'num' }, formatYen(g.tax)), h('td', { class: 'num' }, formatYen(g.totalIncl))))),
      h('tfoot', {}, h('tr', {}, h('th', {}, '合計'), h('td', { class: 'num' }, formatYen(t.totalExcl)), h('td', { class: 'num' }, formatYen(t.totalTax)), h('td', { class: 'num' }, formatYen(t.grandTotal))))),
    iss.bank ? h('div', { class: 'bank' }, h('strong', {}, '振込先'), h('p', { class: 'pre' }, iss.bank)) : '',
    current.note ? h('div', { class: 'bank' }, h('strong', {}, '備考'), h('p', { class: 'pre' }, current.note)) : '',
  )
}

// ---------- 初期化 ----------
loadIssuerForm()
renderList()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
