import './style.css'
import {
  calcTotals,
  formatYen,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumber,
  type RoundingMode,
  type TaxRate,
} from './calc'
import { buildItemsCsvBlob, safeFileStem } from './csv'
import { defaultState, loadState, parseState, saveState, stateToJsonBlob, type InvoiceState } from './state'

const state: InvoiceState = loadState() ?? defaultState()

type Attrs = Record<string, string>
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) e.append(c)
  return e
}

function field(label: string, input: HTMLElement): HTMLElement {
  return el('label', { class: 'field' }, [el('span', {}, [label]), input])
}

function textInput(id: string, key: keyof InvoiceState, placeholder = ''): HTMLInputElement {
  const i = el('input', { id, type: 'text', placeholder, autocomplete: 'off' })
  i.value = String(state[key] ?? '')
  i.addEventListener('input', () => {
    ;(state as unknown as Record<string, unknown>)[key] = i.value
    update()
  })
  return i
}

function textArea(id: string, key: 'bankInfo' | 'note' | 'issuerAddress', rows = 3): HTMLTextAreaElement {
  const t = el('textarea', { id, rows: String(rows) })
  t.value = state[key]
  t.addEventListener('input', () => {
    state[key] = t.value
    update()
  })
  return t
}

function dateInput(id: string, key: 'issueDate' | 'dueDate'): HTMLInputElement {
  const i = el('input', { id, type: 'date' })
  i.value = state[key]
  i.addEventListener('input', () => {
    state[key] = i.value
    update()
  })
  return i
}

// ---- 明細行 ----
const itemsBody = el('tbody', { id: 'items-body' })

function renderItemRows(): void {
  itemsBody.replaceChildren()
  state.items.forEach((it, idx) => {
    const name = el('input', { type: 'text', 'aria-label': `品名 ${idx + 1}`, class: 'item-name' })
    name.value = it.name
    name.addEventListener('input', () => {
      it.name = name.value
      update()
    })
    const qty = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量 ${idx + 1}`, class: 'item-qty' })
    qty.value = String(it.quantity)
    qty.addEventListener('input', () => {
      const n = parseNumber(qty.value)
      qty.classList.toggle('invalid', n === null)
      if (n !== null) it.quantity = n
      update()
    })
    const price = el('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価 ${idx + 1}`, class: 'item-price' })
    price.value = String(it.unitPriceYen)
    price.addEventListener('input', () => {
      const n = parseNumber(price.value)
      price.classList.toggle('invalid', n === null)
      if (n !== null) it.unitPriceYen = n
      update()
    })
    const rate = el('select', { 'aria-label': `税率 ${idx + 1}`, class: 'item-rate' }, [
      el('option', { value: '10' }, ['10%']),
      el('option', { value: '8' }, ['8%（軽減税率）']),
      el('option', { value: '0' }, ['0%（非課税・不課税）']),
    ])
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => {
      it.taxRate = Number(rate.value) as TaxRate
      update()
    })
    const del = el('button', { type: 'button', class: 'danger', 'aria-label': `明細 ${idx + 1} を削除` }, ['削除'])
    del.addEventListener('click', () => {
      state.items.splice(idx, 1)
      if (state.items.length === 0) state.items.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
      renderItemRows()
      update()
    })
    itemsBody.append(
      el('tr', {}, [
        el('td', {}, [name]),
        el('td', {}, [qty]),
        el('td', {}, [price]),
        el('td', {}, [rate]),
        el('td', {}, [del]),
      ]),
    )
  })
}

// ---- プレビュー（印刷対象） ----
const preview = el('section', { id: 'preview', class: 'paper', 'aria-label': '請求書プレビュー' })
const status = el('p', { id: 'status', class: 'status', role: 'status' })
const warnings = el('ul', { id: 'warnings', class: 'warnings' })

function row(label: string, value: string): HTMLElement {
  return el('tr', {}, [el('th', {}, [label]), el('td', {}, [value])])
}

function lines(text: string): (Node | string)[] {
  const out: (Node | string)[] = []
  text.split(/\r?\n/).forEach((l, i) => {
    if (i > 0) out.push(el('br'))
    out.push(l)
  })
  return out
}

function renderPreview(): void {
  const t = calcTotals(state.items, state.rounding)
  const reg = normalizeRegistrationNumber(state.registrationNumber)
  const meta = el('table', { class: 'meta' }, [
    row('請求書番号', state.invoiceNumber || '-'),
    row('発行日（取引年月日）', state.issueDate || '-'),
    row('お支払期限', state.dueDate || '-'),
  ])
  const itemsTable = el('table', { class: 'lines' }, [
    el('thead', {}, [
      el('tr', {}, ['品名', '数量', '単価（税抜）', '税率', '金額（税抜）'].map((h) => el('th', {}, [h]))),
    ]),
    el(
      'tbody',
      {},
      state.items.map((it, i) =>
        el('tr', {}, [
          el('td', {}, [(it.name || '（品名未入力）') + (it.taxRate === 8 ? ' ※' : '')]),
          el('td', { class: 'num' }, [String(it.quantity)]),
          el('td', { class: 'num' }, [formatYen(it.unitPriceYen)]),
          el('td', { class: 'num' }, [`${it.taxRate}%`]),
          el('td', { class: 'num' }, [formatYen(t.lineAmounts[i])]),
        ]),
      ),
    ),
  ])
  const rateTable = el('table', { class: 'rates' }, [
    el('thead', {}, [el('tr', {}, ['税率区分', '税抜合計', '消費税額'].map((h) => el('th', {}, [h])))]),
    el(
      'tbody',
      {},
      t.byRate.map((r) =>
        el('tr', {}, [
          el('td', {}, [r.rate === 0 ? '0%（非課税・不課税）' : `${r.rate}%対象${r.rate === 8 ? '（※軽減税率）' : ''}`]),
          el('td', { class: 'num' }, [formatYen(r.subtotalYen)]),
          el('td', { class: 'num' }, [formatYen(r.taxYen)]),
        ]),
      ),
    ),
  ])
  const hasReduced = state.items.some((i) => i.taxRate === 8)
  preview.replaceChildren(
    el('h2', { class: 'doc-title' }, ['請求書']),
    el('div', { class: 'parties' }, [
      el('div', { class: 'client' }, [
        el('p', { class: 'client-name', id: 'pv-client' }, [(state.clientName || '（請求先未入力）') + ' 御中']),
        el('p', { class: 'total-line', id: 'pv-total' }, ['ご請求金額（税込）　', el('strong', {}, [formatYen(t.totalYen)])]),
      ]),
      el('div', { class: 'issuer' }, [
        el('p', { class: 'issuer-name', id: 'pv-issuer' }, [state.issuerName || '（発行者名未入力）']),
        el('p', {}, lines(state.issuerAddress)),
        el('p', {}, lines(state.issuerContact)),
        el('p', { id: 'pv-reg' }, [reg ? `登録番号: ${reg}` : '登録番号: （未入力）']),
      ]),
    ]),
    meta,
    itemsTable,
    hasReduced ? el('p', { class: 'small' }, ['※は軽減税率（8%）対象の品目です。']) : el('span'),
    rateTable,
    el('table', { class: 'sum' }, [
      row('税抜合計', formatYen(t.subtotalYen)),
      row('消費税額合計', formatYen(t.taxYen)),
      row('ご請求金額（税込）', formatYen(t.totalYen)),
    ]),
    state.bankInfo ? el('div', { class: 'block' }, [el('h3', {}, ['お振込先']), el('p', {}, lines(state.bankInfo))]) : el('span'),
    state.note ? el('div', { class: 'block' }, [el('h3', {}, ['備考']), el('p', {}, lines(state.note))]) : el('span'),
  )
}

function renderWarnings(): void {
  const w: string[] = []
  if (!isValidRegistrationNumber(state.registrationNumber)) {
    w.push('登録番号が「T」+数字13桁の形式ではありません。適格請求書として発行する場合は国税庁に登録された番号を入力してください。')
  }
  if (!state.issuerName.trim()) w.push('発行者（氏名または名称）が未入力です。')
  if (!state.clientName.trim()) w.push('請求先（書類の交付を受ける事業者の氏名または名称）が未入力です。')
  if (!state.issueDate) w.push('発行日（取引年月日）が未入力です。')
  if (state.items.some((i) => !i.name.trim())) w.push('品名が空の明細があります。')
  warnings.replaceChildren(...w.map((m) => el('li', {}, [m])))
}

function update(): void {
  renderPreview()
  renderWarnings()
  const ok = saveState(state)
  status.textContent = ok ? 'ブラウザ内に自動保存しました（外部送信なし）' : 'ブラウザの保存領域が使えないため自動保存できません。JSON書き出しでバックアップしてください。'
}

// ---- ダウンロード ----
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function button(id: string, label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { id, type: 'button', class: cls }, [label])
  b.addEventListener('click', onClick)
  return b
}

const importInput = el('input', { id: 'import-file', type: 'file', accept: 'application/json,.json', class: 'hidden' })
const importMsg = el('p', { id: 'import-msg', class: 'status', role: 'status' })
importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0]
  importInput.value = ''
  if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('size')
    let text = await file.text()
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const next = parseState(JSON.parse(text))
    if (!next) throw new Error('shape')
    Object.assign(state, next)
    buildForm()
    update()
    importMsg.textContent = 'JSONを読み込みました。'
  } catch {
    importMsg.textContent = '読み込めませんでした。このツールで書き出したJSONファイルを選んでください。'
  }
})

function printInvoice(): void {
  const prev = document.title
  document.title = safeFileStem(state.invoiceNumber)
  window.print()
  document.title = prev
}

// ---- フォーム ----
const formRoot = el('div', { class: 'form' })

function buildForm(): void {
  const rounding = el('select', { id: 'rounding' }, [
    el('option', { value: 'floor' }, ['切り捨て']),
    el('option', { value: 'round' }, ['四捨五入']),
    el('option', { value: 'ceil' }, ['切り上げ']),
  ])
  rounding.value = state.rounding
  rounding.addEventListener('change', () => {
    state.rounding = rounding.value as RoundingMode
    update()
  })
  renderItemRows()
  const addBtn = button('add-item', '＋ 明細を追加', () => {
    state.items.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
    renderItemRows()
    update()
  })
  formRoot.replaceChildren(
    el('fieldset', {}, [
      el('legend', {}, ['発行者（あなた）']),
      field('氏名または名称', textInput('issuerName', 'issuerName', '例: 山田デザイン事務所')),
      field('登録番号（T+13桁）', textInput('registrationNumber', 'registrationNumber', 'T1234567890123')),
      field('住所', textArea('issuerAddress', 'issuerAddress', 2)),
      field('連絡先（電話・メール）', textInput('issuerContact', 'issuerContact')),
      field('お振込先', textArea('bankInfo', 'bankInfo', 3)),
    ]),
    el('fieldset', {}, [
      el('legend', {}, ['請求先・請求書情報']),
      field('請求先（書類の交付先の名称）', textInput('clientName', 'clientName', '例: 株式会社サンプル')),
      field('請求書番号', textInput('invoiceNumber', 'invoiceNumber')),
      field('発行日（取引年月日）', dateInput('issueDate', 'issueDate')),
      field('お支払期限', dateInput('dueDate', 'dueDate')),
      field('備考', textArea('note', 'note', 2)),
    ]),
    el('fieldset', {}, [
      el('legend', {}, ['明細（金額は税抜で入力）']),
      el('div', { class: 'table-wrap' }, [
        el('table', { class: 'items' }, [
          el('thead', {}, [el('tr', {}, ['品名', '数量', '単価（税抜）', '税率', ''].map((h) => el('th', {}, [h])))]),
          itemsBody,
        ]),
      ]),
      addBtn,
      field('消費税の端数処理（税率ごとに1回）', rounding),
    ]),
  )
}

function mount(): void {
  const app = document.getElementById('app')!
  buildForm()
  app.append(
    el('header', { class: 'site-header no-print' }, [
      el('h1', {}, ['請求書メーカー（インボイス対応）']),
      el('p', { class: 'lead' }, [
        '登録不要・オフラインでも使えます。入力内容はこのブラウザの中だけに保存され、外部へ送信されません。',
      ]),
    ]),
    el('main', { class: 'layout' }, [
      el('div', { class: 'editor no-print' }, [
        formRoot,
        warnings,
        el('div', { class: 'actions' }, [
          button('print-btn', '印刷 / PDFとして保存', printInvoice, 'primary'),
          button('export-csv', '明細をCSVで保存', () =>
            download(buildItemsCsvBlob(state), `${safeFileStem(state.invoiceNumber)}.csv`),
          ),
          button('export-json', 'データをJSONで書き出し', () =>
            download(stateToJsonBlob(state), `${safeFileStem(state.invoiceNumber)}.json`),
          ),
          button('import-btn', 'JSONを読み込み', () => importInput.click()),
          importInput,
        ]),
        importMsg,
        status,
      ]),
      el('div', { class: 'preview-col' }, [preview]),
    ]),
    el('footer', { class: 'site-footer no-print' }, [
      el('p', {}, [
        '本ツールの出力は書式作成の補助です。適格請求書の要件・税額計算・登録状況は、国税庁の公表情報や税理士等でご確認ください。',
      ]),
    ]),
  )
  update()
}

mount()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
