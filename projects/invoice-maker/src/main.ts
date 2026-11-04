import './style.css'
import { calcTotals, formatYen, isValidRegistrationNumber, parseNumber, type LineItem, type Rounding, type TaxRate } from './calc'
import { buildInvoiceCsvBlob, safeFileName } from './csv'
import {
  emptyInvoice,
  emptyItem,
  newId,
  parseDataFromJsonText,
  sanitizeInvoice,
  todayString,
  type AppData,
  type Invoice,
} from './model'
import { dataToJsonBlob, loadData, saveData } from './storage'

let data: AppData = loadData()

type Child = Node | string | null | undefined
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) {
    if (c === null || c === undefined) continue
    e.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return e
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

let statusEl: HTMLElement
function setStatus(msg: string): void {
  statusEl.textContent = msg
}
function persist(): void {
  if (!saveData(data)) setStatus('ブラウザの保存領域が使えないため、入力内容は保存されません（JSONバックアップをご利用ください）。')
}

/* ---------- フォーム部品 ---------- */
function textField(label: string, get: () => string, set: (v: string) => void, opts: { type?: string; area?: boolean; id?: string; placeholder?: string } = {}): HTMLElement {
  const input = opts.area
    ? h('textarea', { rows: '3' })
    : h('input', { type: opts.type ?? 'text', autocomplete: 'off' })
  if (opts.id) input.id = opts.id
  if (opts.placeholder) input.setAttribute('placeholder', opts.placeholder)
  input.value = get()
  input.addEventListener('input', () => {
    set(input.value)
    persist()
    renderPreview()
  })
  return h('label', {}, label, input)
}

/* ---------- 画面 ---------- */
const root = document.getElementById('app') as HTMLElement
let itemsBody: HTMLElement
let previewEl: HTMLElement
let savedListEl: HTMLElement
let summaryEl: HTMLElement
let regErrEl: HTMLElement
let formCard: HTMLElement

function buildApp(): void {
  root.replaceChildren()
  statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' })

  const header = h(
    'header',
    { class: 'no-print' },
    h('h1', {}, 'インボイス対応 請求書メーカー'),
    h('p', { class: 'lead' }, '登録不要・オフライン対応。入力した内容はこのブラウザの中にだけ保存され、外部には送信されません。'),
    h(
      'div',
      { class: 'notice' },
      '本ツールは請求書作成の補助です。税務上の取り扱い（記載事項・端数処理・源泉徴収の要否など）は国税庁の公表情報や税理士にご確認ください。ブラウザのデータを消去すると保存内容も消えるため、定期的に「JSONバックアップ」を保存してください。',
    ),
  )

  // 発行者
  regErrEl = h('div', { class: 'error', id: 'reg-error' })
  const issuerCard = h(
    'section',
    { class: 'card no-print', 'aria-label': '発行者情報' },
    h('h2', {}, '1. 発行者（あなた）の情報'),
    h(
      'div',
      { class: 'grid' },
      textField('氏名・屋号・会社名', () => data.issuer.name, (v) => (data.issuer.name = v), { id: 'issuer-name' }),
      h(
        'div',
        {},
        textField('適格請求書発行事業者の登録番号（T+13桁）', () => data.issuer.registrationNumber, (v) => {
          data.issuer.registrationNumber = v
          validateRegistration()
        }, { id: 'issuer-reg', placeholder: 'T1234567890123' }),
        regErrEl,
      ),
      textField('住所', () => data.issuer.address, (v) => (data.issuer.address = v), { area: true, id: 'issuer-address' }),
      textField('電話番号', () => data.issuer.phone, (v) => (data.issuer.phone = v)),
      textField('メールアドレス', () => data.issuer.email, (v) => (data.issuer.email = v), { type: 'email' }),
      textField('振込先', () => data.issuer.bankInfo, (v) => (data.issuer.bankInfo = v), { area: true, id: 'issuer-bank' }),
    ),
  )

  // 請求書情報
  const inv = data.draft
  const honorificSel = h('select', { id: 'honorific' }, ...['御中', '様', ''].map((v) => h('option', { value: v }, v === '' ? '（なし）' : v)))
  honorificSel.value = inv.honorific
  honorificSel.addEventListener('change', () => {
    data.draft.honorific = honorificSel.value
    persist()
    renderPreview()
  })
  const invoiceInfo = h(
    'div',
    { class: 'grid' },
    textField('請求書番号', () => data.draft.number, (v) => (data.draft.number = v), { id: 'inv-number', placeholder: '例: 2026-001' }),
    textField('発行日', () => data.draft.issueDate, (v) => (data.draft.issueDate = v), { type: 'date', id: 'inv-issue' }),
    textField('支払期限', () => data.draft.dueDate, (v) => (data.draft.dueDate = v), { type: 'date', id: 'inv-due' }),
    textField('請求先名', () => data.draft.clientName, (v) => (data.draft.clientName = v), { id: 'client-name' }),
    h('label', {}, '敬称', honorificSel),
    textField('請求先住所', () => data.draft.clientAddress, (v) => (data.draft.clientAddress = v), { area: true }),
    textField('件名', () => data.draft.subject, (v) => (data.draft.subject = v), { id: 'inv-subject' }),
  )

  itemsBody = h('tbody')
  const table = h(
    'table',
    { class: 'items' },
    h('thead', {}, h('tr', {}, ...['品名', '数量', '単価（税抜・円）', '税率', '金額（税抜）', ''].map((t) => h('th', {}, t)))),
    itemsBody,
  )
  const addBtn = h('button', { type: 'button', id: 'add-item' }, '＋ 明細を追加')
  addBtn.addEventListener('click', () => {
    if (data.draft.items.length >= 200) return setStatus('明細は200行までです。')
    data.draft.items.push(emptyItem())
    persist()
    renderItems()
    renderPreview()
  })

  const roundSel = h(
    'select',
    { id: 'rounding' },
    h('option', { value: 'floor' }, '切り捨て'),
    h('option', { value: 'round' }, '四捨五入'),
    h('option', { value: 'ceil' }, '切り上げ'),
  )
  roundSel.value = inv.rounding
  roundSel.addEventListener('change', () => {
    data.draft.rounding = roundSel.value as Rounding
    persist()
    renderItems()
    renderPreview()
  })
  const wh = h('input', { type: 'checkbox', id: 'withholding', style: 'width:auto' })
  wh.checked = inv.withholding
  wh.addEventListener('change', () => {
    data.draft.withholding = wh.checked
    persist()
    renderPreview()
  })
  summaryEl = h('div', { id: 'summary', 'aria-live': 'polite' })

  formCard = h(
    'section',
    { class: 'card no-print', 'aria-label': '請求書の内容' },
    h('h2', {}, '2. 請求書の内容'),
    invoiceInfo,
    h('h2', { style: 'margin-top:16px' }, '明細'),
    table,
    h('div', { class: 'row' }, addBtn),
    h(
      'div',
      { class: 'row' },
      h('label', {}, '端数処理（消費税・各明細）', roundSel),
      h('label', { style: 'display:flex;gap:6px;align-items:center' }, wh, '報酬の源泉徴収税を差し引く（10.21%／100万円超の部分20.42%）'),
    ),
    summaryEl,
    textField('備考', () => data.draft.notes, (v) => (data.draft.notes = v), { area: true, id: 'inv-notes' }),
  )

  // 操作
  const printBtn = h('button', { type: 'button', class: 'primary', id: 'print' }, '印刷 / PDFとして保存')
  printBtn.addEventListener('click', () => window.print())
  const csvBtn = h('button', { type: 'button', id: 'export-csv' }, 'CSVをダウンロード')
  csvBtn.addEventListener('click', () => {
    download(buildInvoiceCsvBlob(data.draft), safeFileName('invoice', data.draft.number, 'csv', data.draft.issueDate))
    setStatus('CSVをダウンロードしました（Excelで開いても文字化けしないUTF-8 BOM付き）。')
  })
  const saveBtn = h('button', { type: 'button', id: 'save-invoice' }, 'この請求書を保存')
  saveBtn.addEventListener('click', () => {
    const snap = sanitizeInvoice({ ...data.draft, savedAt: new Date().toISOString() })
    const idx = data.invoices.findIndex((i) => i.id === snap.id)
    if (idx >= 0) data.invoices[idx] = snap
    else data.invoices.unshift(snap)
    persist()
    renderSaved()
    setStatus('保存しました。')
  })
  const newBtn = h('button', { type: 'button', id: 'new-invoice' }, '新しい請求書')
  newBtn.addEventListener('click', () => {
    data.draft = emptyInvoice()
    persist()
    buildApp()
    setStatus('新しい請求書を開始しました。')
  })
  const actions = h(
    'section',
    { class: 'card no-print', 'aria-label': '操作' },
    h('h2', {}, '3. 出力・保存'),
    h('div', { class: 'row' }, printBtn, csvBtn, saveBtn, newBtn),
    h('p', { class: 'lead' }, '「印刷 / PDFとして保存」を押し、送信先で「PDFに保存」を選ぶとPDFになります。'),
    statusEl,
  )

  // 保存済み
  savedListEl = h('ul', { class: 'saved-list', id: 'saved-list' })
  const saved = h('section', { class: 'card no-print', 'aria-label': '保存済みの請求書' }, h('h2', {}, '保存済みの請求書'), savedListEl)

  // バックアップ
  const exportBtn = h('button', { type: 'button', id: 'export-json' }, 'JSONバックアップを保存')
  exportBtn.addEventListener('click', () => {
    download(dataToJsonBlob(data), `invoice-maker-backup-${todayString()}.json`)
    setStatus('バックアップを保存しました。')
  })
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', id: 'import-json', style: 'display:none' })
  const importBtn = h('button', { type: 'button', id: 'import-json-btn' }, 'JSONバックアップを読み込む')
  importBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]
    if (!f) return
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error('ファイルが大きすぎます（20MBまで）。')
      data = parseDataFromJsonText(await f.text())
      persist()
      buildApp()
      setStatus('バックアップを読み込みました（現在の内容は置き換えられました）。')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '読み込みに失敗しました。')
    } finally {
      fileInput.value = ''
    }
  })
  const backup = h(
    'section',
    { class: 'card no-print', 'aria-label': 'バックアップ' },
    h('h2', {}, 'バックアップ'),
    h('p', { class: 'lead' }, '発行者情報と保存済みの請求書をまとめて保存・復元できます。読み込むと現在の内容は置き換わります。'),
    h('div', { class: 'row' }, exportBtn, importBtn, fileInput),
  )

  previewEl = h('section', { class: 'paper', id: 'preview', 'aria-label': '請求書プレビュー' })
  const footer = h('footer', { class: 'no-print' }, '© 2026 kanasi1119s-ops ／ 外部通信なし・Cookieなし・アクセス解析なし')

  root.append(h('div', { class: 'wrap' }, header, issuerCard, formCard, actions, saved, backup, h('h2', { class: 'no-print' }, 'プレビュー'), previewEl, footer))
  validateRegistration()
  renderItems()
  renderSaved()
  renderPreview()
}

function validateRegistration(): void {
  const v = data.issuer.registrationNumber.trim()
  regErrEl.textContent = v === '' || isValidRegistrationNumber(v) ? '' : '「T」＋数字13桁の形式で入力してください（例: T1234567890123）。'
}

function numberInput(value: number, onValid: (n: number) => void, id?: string): HTMLInputElement {
  const input = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off' })
  if (id) input.id = id
  let lastValid = value
  input.value = String(value)
  input.addEventListener('input', () => {
    const n = parseNumber(input.value)
    if (Number.isNaN(n)) {
      input.setAttribute('aria-invalid', 'true')
      return
    }
    input.removeAttribute('aria-invalid')
    lastValid = n
    onValid(n)
    persist()
    refreshAmounts()
    renderPreview()
  })
  input.addEventListener('blur', () => {
    const n = parseNumber(input.value)
    input.value = String(Number.isNaN(n) ? lastValid : n)
    input.removeAttribute('aria-invalid')
  })
  return input
}

const amountCells: HTMLElement[] = []
function refreshAmounts(): void {
  const t = calcTotals(data.draft.items, data.draft.rounding, data.draft.withholding)
  amountCells.forEach((c, i) => (c.textContent = formatYen(t.lineAmountsYen[i] ?? 0)))
}

function renderItems(): void {
  itemsBody.replaceChildren()
  amountCells.length = 0
  data.draft.items.forEach((it: LineItem, idx: number) => {
    const desc = h('input', { type: 'text', autocomplete: 'off', 'aria-label': `品名 ${idx + 1}` })
    desc.value = it.description
    desc.addEventListener('input', () => {
      it.description = desc.value
      persist()
      renderPreview()
    })
    const rate = h(
      'select',
      { 'aria-label': `税率 ${idx + 1}` },
      h('option', { value: '10' }, '10%'),
      h('option', { value: '8' }, '8%（軽減）'),
      h('option', { value: '0' }, '非課税・不課税'),
    )
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => {
      it.taxRate = Number(rate.value) as TaxRate
      persist()
      refreshAmounts()
      renderPreview()
    })
    const qty = numberInput(it.quantity, (n) => (it.quantity = n))
    qty.setAttribute('aria-label', `数量 ${idx + 1}`)
    const price = numberInput(it.unitPriceYen, (n) => (it.unitPriceYen = n))
    price.setAttribute('aria-label', `単価 ${idx + 1}`)
    const amt = h('td', { class: 'amt' }, '')
    amountCells.push(amt)
    const del = h('button', { type: 'button', class: 'danger', 'aria-label': `明細 ${idx + 1} を削除` }, '削除')
    del.addEventListener('click', () => {
      data.draft.items.splice(idx, 1)
      if (data.draft.items.length === 0) data.draft.items.push(emptyItem())
      persist()
      renderItems()
      renderPreview()
    })
    itemsBody.append(
      h('tr', {}, h('td', {}, desc), h('td', { class: 'num' }, qty), h('td', { class: 'num' }, price), h('td', { class: 'rate' }, rate), amt, h('td', {}, del)),
    )
  })
  refreshAmounts()
}

function renderSaved(): void {
  savedListEl.replaceChildren()
  if (data.invoices.length === 0) {
    savedListEl.append(h('li', {}, 'まだ保存された請求書はありません。'))
    return
  }
  for (const s of data.invoices) {
    const t = calcTotals(s.items, s.rounding, s.withholding)
    const load = h('button', { type: 'button', 'data-action': 'load' }, '読み込む')
    load.addEventListener('click', () => {
      data.draft = sanitizeInvoice(s)
      persist()
      buildApp()
      setStatus('保存済みの請求書を読み込みました。')
    })
    const dup = h('button', { type: 'button', 'data-action': 'duplicate' }, '複製')
    dup.addEventListener('click', () => {
      const copy = sanitizeInvoice({ ...s, id: newId(), number: '', issueDate: todayString(), savedAt: '' })
      data.draft = copy
      persist()
      buildApp()
      setStatus('複製しました（請求書番号は空にしてあります）。')
    })
    const del = h('button', { type: 'button', class: 'danger', 'data-action': 'delete' }, '削除')
    del.addEventListener('click', () => {
      if (!window.confirm('この保存済み請求書を削除しますか？')) return
      data.invoices = data.invoices.filter((i) => i.id !== s.id)
      persist()
      renderSaved()
    })
    savedListEl.append(
      h(
        'li',
        {},
        h('span', { class: 'meta' }, `${s.number || '（番号なし）'} ／ ${s.clientName || '（請求先未入力）'} ／ ${s.issueDate} ／ ${formatYen(t.payableYen)}`),
        load,
        dup,
        del,
      ),
    )
  }
}

function rateLabel(r: TaxRate): string {
  return r === 0 ? '非課税・不課税' : r === 8 ? '8%（軽減税率）' : '10%'
}

function renderPreview(): void {
  const inv: Invoice = data.draft
  const iss = data.issuer
  const t = calcTotals(inv.items, inv.rounding, inv.withholding)
  const hasReduced = inv.items.some((i) => i.taxRate === 8)

  summaryEl.replaceChildren(
    h('p', {}, `小計 ${formatYen(t.subtotalYen)} ／ 消費税 ${formatYen(t.taxYen)} ／ 合計 ${formatYen(t.totalYen)}` + (inv.withholding ? ` ／ 源泉徴収 -${formatYen(t.withholdingYen)} ／ 差引請求額 ${formatYen(t.payableYen)}` : '')),
  )

  const itemRows = inv.items.map((it, i) =>
    h(
      'tr',
      {},
      h('td', {}, (it.description || '（品名未入力）') + (it.taxRate === 8 ? ' ※' : '')),
      h('td', { class: 'r' }, String(it.quantity)),
      h('td', { class: 'r' }, formatYen(it.unitPriceYen)),
      h('td', { class: 'r' }, it.taxRate === 0 ? '非課税' : `${it.taxRate}%`),
      h('td', { class: 'r' }, formatYen(t.lineAmountsYen[i])),
    ),
  )
  const sumRows: HTMLElement[] = []
  for (const r of t.byRate) {
    sumRows.push(
      h('tr', {}, h('th', {}, `${rateLabel(r.rate)} 対象`), h('td', { class: 'r' }, formatYen(r.subtotalYen))),
    )
    if (r.rate !== 0) sumRows.push(h('tr', {}, h('th', {}, `${r.rate}% 消費税額`), h('td', { class: 'r' }, formatYen(r.taxYen))))
  }
  sumRows.push(h('tr', {}, h('th', {}, '合計（税込）'), h('td', { class: 'r' }, formatYen(t.totalYen))))
  if (inv.withholding) {
    sumRows.push(h('tr', {}, h('th', {}, '源泉徴収税額'), h('td', { class: 'r' }, '-' + formatYen(t.withholdingYen))))
  }

  const reg = iss.registrationNumber.normalize('NFKC').trim()
  const parts: Child[] = [
    h('h3', {}, '請求書'),
    h(
      'div',
      { class: 'head' },
      h(
        'div',
        {},
        h('div', { class: 'client' }, `${inv.clientName || '（請求先）'} ${inv.honorific}`),
        h('div', { class: 'pre small' }, inv.clientAddress),
        h('p', {}, inv.subject ? `件名: ${inv.subject}` : ''),
      ),
      h(
        'div',
        {},
        h('div', {}, `請求書番号: ${inv.number}`),
        h('div', {}, `発行日: ${inv.issueDate}`),
        h('div', {}, inv.dueDate ? `支払期限: ${inv.dueDate}` : ''),
        h('div', { style: 'margin-top:8px;font-weight:bold' }, iss.name),
        h('div', { class: 'pre' }, iss.address),
        h('div', {}, iss.phone ? `TEL: ${iss.phone}` : ''),
        h('div', {}, iss.email),
        h('div', {}, reg ? `登録番号: ${reg}` : ''),
      ),
    ),
    h('div', { class: 'total-box' }, h('span', {}, inv.withholding ? 'ご請求金額（源泉徴収後）' : 'ご請求金額（税込）'), h('span', { id: 'preview-total' }, formatYen(t.payableYen))),
    h('table', {}, h('thead', {}, h('tr', {}, ...['品名', '数量', '単価（税抜）', '税率', '金額（税抜）'].map((x) => h('th', {}, x)))), h('tbody', {}, ...itemRows)),
    hasReduced ? h('div', { class: 'small' }, '※ は軽減税率（8%）対象の品目です。') : null,
    h('table', { class: 'sum' }, h('tbody', {}, ...sumRows)),
    iss.bankInfo ? h('div', {}, h('p', { class: 'small' }, '振込先'), h('div', { class: 'pre' }, iss.bankInfo)) : null,
    inv.notes ? h('div', {}, h('p', { class: 'small' }, '備考'), h('div', { class: 'pre' }, inv.notes)) : null,
  ]
  previewEl.replaceChildren(...parts.filter((c): c is Node | string => c !== null && c !== undefined))
}

buildApp()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* オフラインキャッシュが使えなくても通常動作は継続 */
    })
  })
}
