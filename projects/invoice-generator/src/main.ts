import './style.css'
import { calcInvoice, formatYen, parseNumberInput, type RoundingMode, type TaxRate } from './calc'
import { buildCsvBlob, safeFileName } from './csv'
import { newInvoice, normalizeRegNo, validateInvoice, type Invoice } from './model'
import { exportJson, loadAll, parseImport, saveAll, upsert } from './storage'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  const { class: cls, ...rest } = props as Record<string, unknown>
  if (cls) e.className = String(cls)
  Object.assign(e, rest)
  for (const c of children) e.append(c)
  return e
}

let current: Invoice = newInvoice()
let saved: Invoice[] = loadAll()

const app = document.getElementById('app')!

function field(label: string, id: string, value: string, type = 'text', onInput: (v: string) => void): HTMLElement {
  const input = el('input', { id, type, value })
  input.addEventListener('input', () => {
    onInput(input.value)
    renderPreview()
  })
  return el('label', {}, label, input)
}

function build(): void {
  app.replaceChildren()
  const wrap = el('div', { class: 'wrap' })

  const header = el('header', { class: 'no-print' })
  header.append(
    el('h1', {}, 'インボイス請求書ジェネレーター'),
    el('p', { class: 'lead' }, '適格請求書の記載事項に沿った請求書を作り、印刷・PDF保存できます。'),
    el(
      'ul',
      { class: 'badges' },
      el('li', {}, '登録不要'),
      el('li', {}, '入力データはブラウザ外へ送信しません'),
      el('li', {}, 'オフラインでも動作'),
    ),
  )

  // 発行者・宛先
  const basic = el('section', { class: 'card no-print' }, el('h2', {}, '基本情報'))
  const grid = el('div', { class: 'grid' })
  grid.append(
    field('請求書番号', 'invoiceNo', current.invoiceNo, 'text', (v) => (current.invoiceNo = v)),
    field('発行日（取引年月日）', 'issueDate', current.issueDate, 'date', (v) => (current.issueDate = v)),
    field('支払期限', 'dueDate', current.dueDate, 'date', (v) => (current.dueDate = v)),
    field('発行者の氏名又は名称', 'sellerName', current.sellerName, 'text', (v) => (current.sellerName = v)),
    field('登録番号（T+13桁）', 'sellerRegNo', current.sellerRegNo, 'text', (v) => (current.sellerRegNo = v)),
    field('発行者の住所', 'sellerAddress', current.sellerAddress, 'text', (v) => (current.sellerAddress = v)),
    field('宛先（御中・様は不要）', 'buyerName', current.buyerName, 'text', (v) => (current.buyerName = v)),
  )
  basic.append(grid)

  // 明細
  const itemsCard = el('section', { class: 'card no-print' }, el('h2', {}, '明細（単価は税抜）'))
  const tbody = el('tbody', { id: 'items-body' })
  const table = el(
    'table',
    { class: 'items-table' },
    el('thead', {}, el('tr', {}, ...['品名', '数量', '単価(税抜)', '税率', ''].map((t) => el('th', {}, t)))),
    tbody,
  )
  itemsCard.append(el('div', { class: 'items-scroll' }, table))
  const addBtn = el('button', { id: 'add-item', type: 'button' }, '明細を追加')
  addBtn.addEventListener('click', () => {
    current.items.push({ name: '', qty: 1, unitPrice: 0, taxRate: 10 })
    renderItems()
    renderPreview()
  })

  const roundSel = el('select', { id: 'rounding' })
  ;[['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']].forEach(([v, t]) =>
    roundSel.append(el('option', { value: v, selected: current.rounding === v }, t)),
  )
  roundSel.addEventListener('change', () => {
    current.rounding = roundSel.value as RoundingMode
    renderPreview()
  })
  const wh = el('input', { id: 'withholding', type: 'checkbox', checked: current.withholding })
  wh.addEventListener('change', () => {
    current.withholding = wh.checked
    renderPreview()
  })
  const opts = el('div', { class: 'grid' })
  opts.append(
    el('label', {}, '消費税の端数処理（税率ごと・請求書1枚につき1回）', roundSel),
    el('label', {}, wh, ' 源泉徴収税額を差し引く（報酬・料金等／目安）'),
  )
  const note = el('textarea', { id: 'note', value: current.note })
  note.addEventListener('input', () => {
    current.note = note.value
    renderPreview()
  })
  itemsCard.append(el('div', { class: 'actions' }, addBtn), opts, el('label', {}, '備考・振込先など', note))

  // 操作
  const errors = el('ul', { id: 'errors' })
  const status = el('p', { id: 'status', role: 'status' })
  const save = el('button', { id: 'save', type: 'button', class: 'primary' }, 'ブラウザに保存')
  save.addEventListener('click', () => {
    const errs = validateInvoice(current)
    renderErrors(errs)
    if (saveAll((saved = upsert(saved, structuredClone(current))))) setStatus('ブラウザ内に保存しました（外部送信はされません）')
    else setStatus('保存に失敗しました。JSONエクスポートでバックアップしてください')
    renderSaved()
  })
  const print = el('button', { id: 'print', type: 'button', class: 'primary' }, '印刷 / PDF保存')
  print.addEventListener('click', () => {
    const errs = validateInvoice(current)
    renderErrors(errs)
    if (errs.length > 0) {
      setStatus('適格請求書の必須項目に不足があります。内容を確認してください（印刷は続行できます）')
    }
    window.print()
  })
  const csv = el('button', { id: 'export-csv', type: 'button' }, 'CSVダウンロード')
  csv.addEventListener('click', () => download(buildCsvBlob(current), safeFileName('invoice', current.invoiceNo, 'csv')))
  const json = el('button', { id: 'export-json', type: 'button' }, 'JSONバックアップ')
  json.addEventListener('click', () => {
    saved = upsert(saved, structuredClone(current))
    saveAll(saved)
    download(exportJson(saved), 'invoice-generator-backup.json')
  })
  const fileIn = el('input', { id: 'import-json', type: 'file', accept: 'application/json,.json' })
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0]
    if (!f) return
    const list = parseImport(await f.text())
    if (!list) return setStatus('インポートに失敗しました。形式が正しいバックアップJSONか確認してください')
    for (const inv of list) saved = upsert(saved, inv)
    saveAll(saved)
    renderSaved()
    setStatus(`${list.length}件をインポートしました`)
    fileIn.value = ''
  })
  const fresh = el('button', { id: 'new-invoice', type: 'button' }, '新規作成')
  fresh.addEventListener('click', () => {
    current = newInvoice()
    build()
  })
  const ops = el('section', { class: 'card no-print' })
  ops.append(
    el('div', { class: 'actions' }, save, print, csv, json, fresh),
    el('label', {}, 'JSONバックアップを読み込む', fileIn),
    errors,
    status,
  )

  const savedCard = el('section', { class: 'card no-print' }, el('h2', {}, '保存済みの請求書（このブラウザ内のみ）'), el('ul', { id: 'saved', class: 'saved-list' }))

  const preview = el('section', { class: 'card preview' }, el('div', { id: 'preview' }))
  const disclaimer = el(
    'p',
    { class: 'disclaimer no-print' },
    '本ツールは請求書作成の補助です。税務・法律上の判断は国税庁の公表資料や税理士等の専門家にご確認ください。源泉徴収税額は一般的な計算式による目安です。',
  )

  wrap.append(header, basic, itemsCard, ops, preview, savedCard, disclaimer)
  app.append(wrap)
  renderItems()
  renderPreview()
  renderSaved()
}

function setStatus(msg: string): void {
  document.getElementById('status')!.textContent = msg
}

function renderErrors(errs: string[]): void {
  document.getElementById('errors')!.replaceChildren(...errs.map((e) => el('li', {}, e)))
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function renderItems(): void {
  const body = document.getElementById('items-body')!
  body.replaceChildren()
  current.items.forEach((it, i) => {
    const name = el('input', { type: 'text', value: it.name, ariaLabel: `品名${i + 1}` })
    name.addEventListener('input', () => ((it.name = name.value), renderPreview()))
    const qty = el('input', { type: 'text', inputMode: 'decimal', value: String(it.qty), ariaLabel: `数量${i + 1}` })
    qty.addEventListener('input', () => ((it.qty = parseNumberInput(qty.value)), renderPreview()))
    const price = el('input', { type: 'text', inputMode: 'decimal', value: String(it.unitPrice), ariaLabel: `単価${i + 1}` })
    price.addEventListener('input', () => ((it.unitPrice = parseNumberInput(price.value)), renderPreview()))
    const rate = el('select', { ariaLabel: `税率${i + 1}` })
    rate.append(
      el('option', { value: '10', selected: it.taxRate === 10 }, '10%'),
      el('option', { value: '8', selected: it.taxRate === 8 }, '8%（軽減税率）'),
    )
    rate.addEventListener('change', () => ((it.taxRate = Number(rate.value) as TaxRate), renderPreview()))
    const del = el('button', { type: 'button', class: 'danger' }, '削除')
    del.addEventListener('click', () => {
      current.items.splice(i, 1)
      renderItems()
      renderPreview()
    })
    body.append(el('tr', {}, el('td', {}, name), el('td', {}, qty), el('td', {}, price), el('td', {}, rate), el('td', {}, del)))
  })
}

function renderPreview(): void {
  const box = document.getElementById('preview')
  if (!box) return
  const safeItems = current.items.map((it) => ({
    ...it,
    qty: Number.isFinite(it.qty) ? it.qty : 0,
    unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0,
  }))
  const t = calcInvoice(safeItems, current.rounding, current.withholding)
  const reg = normalizeRegNo(current.sellerRegNo)

  const rows = safeItems.map((it, i) =>
    el(
      'tr',
      {},
      el('td', {}, it.name, it.taxRate === 8 ? el('span', { class: 'reduced' }, ' ※') : ''),
      el('td', { class: 'num' }, String(it.qty)),
      el('td', { class: 'num' }, formatYen(it.unitPrice)),
      el('td', { class: 'num' }, `${it.taxRate}%`),
      el('td', { class: 'num' }, formatYen(t.lineAmounts[i])),
    ),
  )
  const sumRows = t.byRate.map((r) =>
    el('tr', {}, el('td', {}, `${r.rate}%対象 税抜合計 ${formatYen(r.subtotal)}`), el('td', { class: 'num' }, `消費税額 ${formatYen(r.tax)}`)),
  )

  const doc = el('div', { class: 'doc', id: 'doc' })
  doc.append(
    el('h2', {}, '請求書'),
    el(
      'div',
      { class: 'meta' },
      el('div', {}, el('span', { class: 'buyer' }, (current.buyerName || '（宛先）') + ' 御中')),
      el(
        'div',
        {},
        el('div', {}, `請求書番号: ${current.invoiceNo}`),
        el('div', {}, `発行日: ${current.issueDate}`),
        el('div', {}, current.dueDate ? `支払期限: ${current.dueDate}` : ''),
        el('div', { id: 'doc-seller' }, current.sellerName || '（発行者名）'),
        el('div', {}, current.sellerAddress),
        el('div', { id: 'doc-regno' }, `登録番号: ${reg || '（未入力）'}`),
      ),
    ),
    el('div', { class: 'total-line', id: 'doc-total' }, `ご請求金額（税込）: ${formatYen(t.total)}`),
    el(
      'table',
      {},
      el('thead', {}, el('tr', {}, ...['品名', '数量', '単価(税抜)', '税率', '金額(税抜)'].map((h) => el('th', {}, h)))),
      el('tbody', {}, ...rows),
    ),
    el('table', {}, el('tbody', {}, ...sumRows)),
    el('p', {}, `税抜合計 ${formatYen(t.subtotal)} ／ 消費税合計 ${formatYen(t.tax)}`),
    current.withholding ? el('p', {}, `源泉徴収税額（目安）-${formatYen(t.withholding)}`) : '',
    safeItems.some((i) => i.taxRate === 8) ? el('p', { class: 'small' }, '※ は軽減税率（8%）対象')  : '',
    el('p', { class: 'pre' }, current.note),
  )
  box.replaceChildren(doc)
}

function renderSaved(): void {
  const ul = document.getElementById('saved')
  if (!ul) return
  if (saved.length === 0) {
    ul.replaceChildren(el('li', {}, '保存済みの請求書はありません'))
    return
  }
  ul.replaceChildren(
    ...saved.map((inv) => {
      const open = el('button', { type: 'button' }, '開く')
      open.addEventListener('click', () => {
        current = structuredClone(inv)
        build()
      })
      const del = el('button', { type: 'button', class: 'danger' }, '削除')
      del.addEventListener('click', () => {
        saved = saved.filter((x) => x.id !== inv.id)
        saveAll(saved)
        renderSaved()
      })
      return el('li', {}, el('span', { class: 'title' }, `${inv.invoiceNo} ／ ${inv.buyerName || '（宛先未入力）'}`), open, del)
    }),
  )
}

build()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
