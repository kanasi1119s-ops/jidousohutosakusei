import './style.css'
import {
  calcInvoice,
  formatYen,
  newInvoice,
  parseNumber,
  validateInvoice,
  type Invoice,
  type Item,
  type Rounding,
  type TaxRate,
} from './invoice'
import { buildCsvBlob, safeFileName } from './csv'
import { buildExportBlob, loadStore, parseStore, saveStore, type StoreData } from './storage'

const store: StoreData = loadStore()
let inv: Invoice = store.current ?? newInvoice(store.lastIssuer)

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) e.append(c)
  return e
}

function persist() {
  store.current = inv
  store.lastIssuer = { ...inv.issuer }
  saveStore(store)
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function field(label: string, input: HTMLElement, cls = ''): HTMLElement {
  return el('label', { class: 'field ' + cls }, el('span', {}, label), input)
}

function textInput(id: string, value: string, onInput: (v: string) => void, attrs: Record<string, string> = {}) {
  const i = el('input', { id, type: 'text', ...attrs })
  i.value = value
  i.addEventListener('input', () => {
    onInput(i.value)
    refresh()
  })
  return i
}

function textArea(id: string, value: string, onInput: (v: string) => void) {
  const t = el('textarea', { id, rows: '3' })
  t.value = value
  t.addEventListener('input', () => {
    onInput(t.value)
    refresh()
  })
  return t
}

const app = document.getElementById('app')!
const formEl = el('div', { class: 'no-print form' })
const previewEl = el('section', { class: 'preview', id: 'preview', 'aria-label': '請求書プレビュー' })
const warnEl = el('ul', { class: 'warnings no-print', id: 'warnings' })
const itemsBody = el('tbody')
const savedList = el('ul', { class: 'saved', id: 'saved-list' })
const msgEl = el('p', { class: 'msg', id: 'msg', role: 'status' })

function setMsg(text: string) {
  msgEl.textContent = text
}

function renderItems() {
  itemsBody.replaceChildren()
  inv.items.forEach((it, idx) => {
    const name = el('input', { type: 'text', 'aria-label': `品名${idx + 1}`, class: 'it-name' })
    name.value = it.name
    name.addEventListener('input', () => ((it.name = name.value), refresh()))
    const qty = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量${idx + 1}`, class: 'it-qty' })
    qty.value = String(it.qty)
    qty.addEventListener('input', () => ((it.qty = parseNumber(qty.value)), refresh()))
    const price = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価${idx + 1}`, class: 'it-price' })
    price.value = String(it.unitPrice)
    price.addEventListener('input', () => ((it.unitPrice = parseNumber(price.value)), refresh()))
    const rate = el('select', { 'aria-label': `税率${idx + 1}`, class: 'it-rate' })
    rate.append(el('option', { value: '10' }, '10%'), el('option', { value: '8' }, '8%（軽減）'))
    rate.value = String(it.rate)
    rate.addEventListener('change', () => ((it.rate = Number(rate.value) as TaxRate), refresh()))
    const del = el('button', { type: 'button', class: 'btn small danger', 'aria-label': `明細${idx + 1}を削除` }, '削除')
    del.addEventListener('click', () => {
      inv.items.splice(idx, 1)
      renderItems()
      refresh()
    })
    const row = el('tr')
    for (const c of [name, qty, price, rate, del]) row.append(el('td', {}, c))
    itemsBody.append(row)
  })
}

function renderForm() {
  const issuerBox = el(
    'fieldset',
    {},
    el('legend', {}, '発行者（あなた）'),
    field('氏名・名称', textInput('f-issuer-name', inv.issuer.name, (v) => (inv.issuer.name = v))),
    field(
      '登録番号（T+13桁）',
      textInput('f-reg-no', inv.issuer.registrationNo, (v) => (inv.issuer.registrationNo = v.trim().replace(/[Ｔ０-９]/g, (c) => (c === 'Ｔ' ? 'T' : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))), {
        placeholder: 'T1234567890123',
        maxlength: '14',
      }),
    ),
    field('住所', textInput('f-issuer-address', inv.issuer.address, (v) => (inv.issuer.address = v))),
    field('連絡先', textInput('f-issuer-contact', inv.issuer.contact, (v) => (inv.issuer.contact = v))),
    field('振込先', textArea('f-bank', inv.issuer.bank, (v) => (inv.issuer.bank = v))),
  )
  const metaBox = el(
    'fieldset',
    {},
    el('legend', {}, '請求内容'),
    field('請求先の名称', textInput('f-customer', inv.customerName, (v) => (inv.customerName = v))),
    field('請求書番号', textInput('f-number', inv.number, (v) => (inv.number = v))),
    field('発行日（取引年月日）', (() => {
      const i = el('input', { id: 'f-issue-date', type: 'date' })
      i.value = inv.issueDate
      i.addEventListener('input', () => ((inv.issueDate = i.value), refresh()))
      return i
    })()),
    field('支払期限', (() => {
      const i = el('input', { id: 'f-due-date', type: 'date' })
      i.value = inv.dueDate
      i.addEventListener('input', () => ((inv.dueDate = i.value), refresh()))
      return i
    })()),
    field('端数処理', (() => {
      const s = el('select', { id: 'f-rounding' })
      s.append(el('option', { value: 'floor' }, '切り捨て'), el('option', { value: 'round' }, '四捨五入'), el('option', { value: 'ceil' }, '切り上げ'))
      s.value = inv.rounding
      s.addEventListener('change', () => ((inv.rounding = s.value as Rounding), refresh()))
      return s
    })()),
    field('備考', textArea('f-notes', inv.notes, (v) => (inv.notes = v))),
  )
  const addBtn = el('button', { type: 'button', class: 'btn', id: 'add-item' }, '明細を追加')
  addBtn.addEventListener('click', () => {
    inv.items.push({ name: '', qty: 1, unitPrice: 0, rate: 10 } as Item)
    renderItems()
    refresh()
  })
  const table = el(
    'table',
    { class: 'items' },
    el('thead', {}, el('tr', {}, ...['品名', '数量', '単価（税抜・円）', '税率', ''].map((h) => el('th', {}, h)))),
    itemsBody,
  )
  const itemsBox = el('fieldset', {}, el('legend', {}, '明細'), el('div', { class: 'table-wrap' }, table), addBtn)

  const btn = (id: string, label: string, fn: () => void, cls = 'btn') => {
    const b = el('button', { type: 'button', id, class: cls }, label)
    b.addEventListener('click', fn)
    return b
  }
  const importInput = el('input', { type: 'file', id: 'import-file', accept: '.json,application/json', class: 'visually-hidden', 'aria-label': 'JSONファイルを選択' })
  importInput.addEventListener('change', async () => {
    const f = importInput.files?.[0]
    if (!f) return
    const parsed = parseStore(await f.text())
    if (!parsed) {
      setMsg('インポートに失敗しました。このアプリで書き出したJSONファイルを選んでください。')
    } else {
      const known = new Set(store.invoices.map((x) => x.id))
      parsed.invoices.forEach((x) => {
        const i = store.invoices.findIndex((y) => y.id === x.id)
        if (known.has(x.id) && i >= 0) store.invoices[i] = x
        else store.invoices.push(x)
      })
      persist()
      renderSaved()
      setMsg(`${parsed.invoices.length}件の請求書をインポートしました。`)
    }
    importInput.value = ''
  })
  const actions = el(
    'div',
    { class: 'actions' },
    btn('save-invoice', '保存', () => {
      const i = store.invoices.findIndex((x) => x.id === inv.id)
      const copy = JSON.parse(JSON.stringify(inv)) as Invoice
      if (i >= 0) store.invoices[i] = copy
      else store.invoices.push(copy)
      persist()
      renderSaved()
      setMsg('この端末のブラウザ内に保存しました。')
    }, 'btn primary'),
    btn('new-invoice', '新規作成', () => {
      inv = newInvoice(store.lastIssuer)
      persist()
      renderAll()
      setMsg('新しい請求書を開始しました（発行者情報は引き継ぎます）。')
    }),
    btn('print-invoice', '印刷 / PDF保存', () => window.print()),
    btn('export-csv', 'CSVダウンロード', () => download(buildCsvBlob(inv), safeFileName(inv.number, 'csv'))),
    btn('export-json', 'JSONバックアップ', () => download(buildExportBlob(store), 'invoice-maker-backup.json')),
    btn('import-json', 'JSON読み込み', () => importInput.click()),
    importInput,
  )
  formEl.replaceChildren(issuerBox, metaBox, itemsBox, actions, msgEl, el('h2', {}, '保存済みの請求書'), savedList)
  renderItems()
}

function renderSaved() {
  savedList.replaceChildren()
  if (store.invoices.length === 0) {
    savedList.append(el('li', { class: 'empty' }, 'まだ保存された請求書はありません。'))
    return
  }
  for (const s of store.invoices) {
    const t = calcInvoice(s.items, s.rounding)
    const open = el('button', { type: 'button', class: 'btn small' }, '開く')
    open.addEventListener('click', () => {
      inv = JSON.parse(JSON.stringify(s)) as Invoice
      persist()
      renderAll()
    })
    const del = el('button', { type: 'button', class: 'btn small danger' }, '削除')
    del.addEventListener('click', () => {
      store.invoices = store.invoices.filter((x) => x.id !== s.id)
      persist()
      renderSaved()
    })
    savedList.append(
      el('li', {}, el('span', { class: 'saved-title' }, `${s.number || '(番号なし)'} / ${s.customerName || '(請求先なし)'} / ${formatYen(t.total)}`), open, del),
    )
  }
}

function dateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function renderPreview() {
  const t = calcInvoice(inv.items, inv.rounding)
  const rows = inv.items.map((it, i) => {
    const mark = it.rate === 8 ? '※' : ''
    return el('tr', {}, el('td', {}, it.name + mark), el('td', { class: 'num' }, Number.isFinite(it.qty) ? String(it.qty) : '0'), el('td', { class: 'num' }, formatYen(Number.isFinite(it.unitPrice) ? it.unitPrice : 0)), el('td', { class: 'num' }, `${it.rate}%`), el('td', { class: 'num' }, formatYen(t.lineAmounts[i])))
  })
  const summary = t.byRate.flatMap((r) => [
    el('tr', {}, el('th', { colspan: '2' }, `${r.rate}%対象（税抜）`), el('td', { class: 'num' }, formatYen(r.subtotal))),
    el('tr', {}, el('th', { colspan: '2' }, `${r.rate}%消費税`), el('td', { class: 'num' }, formatYen(r.tax))),
  ])
  previewEl.replaceChildren(
    el('h1', { class: 'doc-title' }, '請求書'),
    el('div', { class: 'doc-head' },
      el('div', {}, el('p', { class: 'customer' }, (inv.customerName || '（請求先）') + ' 御中'), el('p', { class: 'total-line' }, `ご請求金額（税込）: ${formatYen(t.total)}`)),
      el('div', { class: 'issuer' },
        el('p', {}, `請求書番号: ${inv.number}`),
        el('p', {}, `発行日: ${dateJa(inv.issueDate)}`),
        el('p', {}, `支払期限: ${dateJa(inv.dueDate)}`),
        el('p', { class: 'issuer-name' }, inv.issuer.name),
        el('p', {}, inv.issuer.registrationNo ? `登録番号: ${inv.issuer.registrationNo}` : ''),
        el('p', {}, inv.issuer.address),
        el('p', {}, inv.issuer.contact))),
    el('table', { class: 'doc-items' }, el('thead', {}, el('tr', {}, ...['品名', '数量', '単価', '税率', '金額（税抜）'].map((h) => el('th', {}, h)))), el('tbody', {}, ...rows)),
    inv.items.some((i) => i.rate === 8) ? el('p', { class: 'small' }, '※は軽減税率（8%）対象です。') : el('span'),
    el('table', { class: 'doc-summary' }, el('tbody', {}, ...summary, el('tr', { class: 'grand' }, el('th', { colspan: '2' }, '合計（税込）'), el('td', { class: 'num', id: 'preview-total' }, formatYen(t.total))))),
    inv.issuer.bank ? el('div', { class: 'bank' }, el('h3', {}, 'お振込先'), el('p', { class: 'pre' }, inv.issuer.bank)) : el('span'),
    inv.notes ? el('div', { class: 'bank' }, el('h3', {}, '備考'), el('p', { class: 'pre' }, inv.notes)) : el('span'),
  )
}

function refresh() {
  renderPreview()
  warnEl.replaceChildren(...validateInvoice(inv).map((w) => el('li', {}, w)))
  persist()
}

function renderAll() {
  renderForm()
  renderSaved()
  refresh()
}

const header = el('header', { class: 'no-print site-header' }, el('h1', {}, '請求書メーカー（インボイス対応）'), el('p', { class: 'badge', id: 'privacy-badge' }, '入力データはこの端末のブラウザ内にのみ保存され、外部には送信されません。登録不要・オフライン対応。'))
const footer = el('footer', { class: 'no-print disclaimer' }, el('p', {}, '本ツールは請求書の作成を補助するものであり、税務・法律上の助言ではありません。適格請求書の記載事項・端数処理・登録番号の確認は国税庁の公表資料で必ずご確認ください。作成した請求書の内容の正確性は利用者の責任となります。'), el('p', {}, '保存先はブラウザのローカルストレージです。ブラウザのデータ削除で消えるため、「JSONバックアップ」で定期的に書き出してください。'))
app.append(header, el('main', { class: 'layout' }, formEl, el('div', { class: 'right' }, warnEl, previewEl)), footer)
renderAll()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
