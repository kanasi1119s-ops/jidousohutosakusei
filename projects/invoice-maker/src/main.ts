import './style.css'
import {
  calculateInvoice,
  formatYen,
  normalizeRegistrationNumber,
  parseNumberLoose,
  validateInvoice,
  type InvoiceInput,
  type LineItem,
} from './calc'
import { buildCsvBlob, buildInvoiceCsv, safeFileName } from './csv'
import {
  emptyItem,
  loadState,
  parseStateFromJsonText,
  saveState,
  stateToJsonBlob,
  type AppState,
} from './storage'

let state: AppState = loadState()

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <header class="no-print">
    <h1>インボイス請求書メーカー</h1>
    <p class="subtitle">インボイス制度の記載事項（登録番号・税率ごとの対象額と消費税額）に沿った請求書を作り、印刷・PDF保存できます。</p>
    <div>
      <span class="badge">登録不要</span>
      <span class="badge">入力データは外部送信されません</span>
      <span class="badge">オフラインでも利用可能</span>
    </div>
  </header>
  <div class="layout">
    <div class="no-print" id="form-col">
      <section class="panel">
        <h2>発行者（あなた）</h2>
        <div class="field"><label for="issuerName">氏名または名称</label><input id="issuerName" autocomplete="off" /></div>
        <div class="field"><label for="registrationNumber">登録番号（T+13桁。未登録なら空欄）</label><input id="registrationNumber" placeholder="T1234567890123" autocomplete="off" /></div>
        <div class="field"><label for="postalAddress">住所</label><textarea id="postalAddress"></textarea></div>
        <div class="field"><label for="contact">連絡先（電話・メール）</label><input id="contact" autocomplete="off" /></div>
        <div class="field"><label for="bankInfo">振込先</label><textarea id="bankInfo"></textarea></div>
      </section>
      <section class="panel">
        <h2>請求内容</h2>
        <div class="field"><label for="customerName">宛名（請求先）</label><input id="customerName" autocomplete="off" /></div>
        <div class="row2">
          <div class="field"><label for="invoiceNumber">請求書番号</label><input id="invoiceNumber" autocomplete="off" /></div>
          <div class="field"><label for="issueDate">発行日</label><input type="date" id="issueDate" /></div>
        </div>
        <div class="row2">
          <div class="field"><label for="dueDate">支払期限</label><input type="date" id="dueDate" /></div>
          <div class="field"><label for="priceMode">単価の入力方法</label>
            <select id="priceMode"><option value="excl">税抜価格で入力</option><option value="incl">税込価格で入力</option></select></div>
        </div>
        <div class="field"><label for="rounding">消費税の端数処理</label>
          <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
        <h2>明細</h2>
        <div id="items"></div>
        <button type="button" class="secondary" id="add-item">明細を追加</button>
        <div class="field" style="margin-top:10px"><label for="note">備考</label><textarea id="note"></textarea></div>
      </section>
      <div class="errors" id="errors" role="alert"></div>
      <div class="warn hidden" id="warning"></div>
      <div class="actions">
        <button type="button" id="print">印刷 / PDFで保存</button>
        <button type="button" class="secondary" id="save-invoice">この請求書を保存</button>
        <button type="button" class="secondary" id="export-csv">明細をCSVでダウンロード</button>
      </div>
      <section class="panel" style="margin-top:12px">
        <h2>保存した請求書</h2>
        <ul class="saved-list" id="saved-list"></ul>
        <div class="actions">
          <button type="button" class="secondary" id="export-json">全データをエクスポート(JSON)</button>
          <button type="button" class="secondary" id="import-json">インポート(JSON)</button>
          <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
          <button type="button" class="secondary" id="new-invoice">新しい請求書</button>
        </div>
        <div class="errors" id="import-msg" role="status"></div>
      </section>
    </div>
    <div class="panel preview-wrap"><div class="doc-scroll"><div class="doc" id="preview"></div></div></div>
  </div>
  <p class="disclaimer no-print">
    本ツールは請求書作成の補助を目的とした一般的な計算ツールであり、税務・法律上の助言ではありません。
    適格請求書の記載要件や端数処理は国税庁の公表資料（<a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener noreferrer">適格請求書発行事業者公表サイト</a>等）で必ずご確認ください。
    入力内容はこのブラウザ内にのみ保存され、外部には送信されません。
  </p>
`

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

const issuerFields = ['issuerName', 'registrationNumber', 'postalAddress', 'contact', 'bankInfo'] as const
const issuerKey = { issuerName: 'name', registrationNumber: 'registrationNumber', postalAddress: 'postalAddress', contact: 'contact', bankInfo: 'bankInfo' } as const
const invoiceTextFields = ['customerName', 'invoiceNumber', 'issueDate', 'dueDate', 'note'] as const

function fillForm(): void {
  for (const f of issuerFields) ($(f) as HTMLInputElement).value = state.issuer[issuerKey[f]]
  for (const f of invoiceTextFields) ($(f) as HTMLInputElement).value = state.invoice[f]
  ;($('priceMode') as HTMLSelectElement).value = state.invoice.priceMode
  ;($('rounding') as HTMLSelectElement).value = state.invoice.rounding
  renderItems()
}

function persist(): void {
  saveState(state)
}

function itemRow(item: LineItem, index: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'item'
  wrap.dataset.index = String(index)
  wrap.innerHTML = `
    <div class="field name"><label>品名</label><input class="it-name" autocomplete="off" /></div>
    <div class="grid">
      <div class="field"><label>数量</label><input class="it-qty" inputmode="decimal" autocomplete="off" /></div>
      <div class="field"><label>単価（円）</label><input class="it-price" inputmode="decimal" autocomplete="off" /></div>
      <div class="field"><label>税率</label><select class="it-rate"><option value="10">10%</option><option value="8">8%（軽減）</option></select></div>
    </div>
    <button type="button" class="danger it-del">削除</button>`
  ;(wrap.querySelector('.it-name') as HTMLInputElement).value = item.name
  ;(wrap.querySelector('.it-qty') as HTMLInputElement).value = String(item.quantity)
  ;(wrap.querySelector('.it-price') as HTMLInputElement).value = String(item.unitPriceYen)
  ;(wrap.querySelector('.it-rate') as HTMLSelectElement).value = String(item.taxRate)
  return wrap
}

function renderItems(): void {
  const box = $('items')
  box.replaceChildren(...state.invoice.items.map(itemRow))
}

// 入力途中の不正値（空文字など）を NaN として保持し、検証でエラーにする
function readItems(): LineItem[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#items .item')).map((row) => ({
    name: (row.querySelector('.it-name') as HTMLInputElement).value,
    quantity: parseNumberLoose((row.querySelector('.it-qty') as HTMLInputElement).value),
    unitPriceYen: parseNumberLoose((row.querySelector('.it-price') as HTMLInputElement).value),
    taxRate: (row.querySelector('.it-rate') as HTMLSelectElement).value === '8' ? 8 : 10,
  }))
}

function readForm(): void {
  for (const f of issuerFields) state.issuer[issuerKey[f]] = ($(f) as HTMLInputElement).value
  for (const f of invoiceTextFields) state.invoice[f] = ($(f) as HTMLInputElement).value
  state.invoice.priceMode = ($('priceMode') as HTMLSelectElement).value === 'incl' ? 'incl' : 'excl'
  const r = ($('rounding') as HTMLSelectElement).value
  state.invoice.rounding = r === 'round' || r === 'ceil' ? r : 'floor'
  state.invoice.items = readItems()
}

function td(text: string, cls = ''): HTMLTableCellElement {
  const c = document.createElement('td')
  c.textContent = text
  if (cls) c.className = cls
  return c
}

function th(text: string): HTMLTableCellElement {
  const c = document.createElement('th')
  c.textContent = text
  return c
}

function div(cls: string, text: string): HTMLDivElement {
  const d = document.createElement('div')
  d.className = cls
  d.textContent = text
  return d
}

function renderPreview(errors: string[]): void {
  const inv = state.invoice
  const iss = state.issuer
  const prev = $('preview')
  const result = calculateInvoice({ ...inv, items: inv.items.filter((i) => Number.isFinite(i.quantity) && Number.isFinite(i.unitPriceYen)) })
  const validItems = inv.items.filter((i) => Number.isFinite(i.quantity) && Number.isFinite(i.unitPriceYen))
  const hasReduced = validItems.some((i) => i.taxRate === 8)
  const reg = normalizeRegistrationNumber(iss.registrationNumber)

  const title = document.createElement('h2')
  title.textContent = '請求書'
  const head = document.createElement('div')
  head.className = 'head'
  head.append(div('to', `${inv.customerName || '（宛名）'} 御中`))
  const meta = div('meta', [
    `請求書番号: ${inv.invoiceNumber || '-'}`,
    `発行日: ${inv.issueDate || '-'}`,
    `支払期限: ${inv.dueDate || '-'}`,
  ].join('\n'))
  head.append(meta)

  const issuer = div('issuer', [
    iss.name || '（発行者名）',
    reg ? `登録番号: ${reg}` : '登録番号: （未記入）',
    iss.postalAddress,
    iss.contact,
  ].filter(Boolean).join('\n'))
  issuer.style.margin = '8px 0'
  issuer.style.textAlign = 'right'

  const totalBox = document.createElement('div')
  totalBox.className = 'total-box'
  totalBox.append(div('', 'ご請求金額（税込）'), div('', formatYen(result.totalYen)))
  totalBox.id = 'grand-total'

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const hr = document.createElement('tr')
  hr.append(th('品名'), th('数量'), th('単価'), th('税率'), th('金額'))
  thead.append(hr)
  const tbody = document.createElement('tbody')
  tbody.id = 'preview-items'
  validItems.forEach((it, i) => {
    const tr = document.createElement('tr')
    const name = it.name + (it.taxRate === 8 ? ' ※' : '')
    tr.append(td(name), td(String(it.quantity), 'n'), td(formatYen(it.unitPriceYen), 'n'), td(`${it.taxRate}%`, 'n'), td(formatYen(result.lineAmounts[i]), 'n'))
    tbody.append(tr)
  })
  table.append(thead, tbody)

  const sum = document.createElement('table')
  sum.id = 'preview-summary'
  const sh = document.createElement('tr')
  sh.append(th('税率区分'), th(inv.priceMode === 'excl' ? '対象額（税抜）' : '対象額（税抜）'), th('消費税額'), th('対象額（税込）'))
  sum.append(sh)
  for (const s of result.summaries) {
    const tr = document.createElement('tr')
    tr.append(td(`${s.rate}%対象`), td(formatYen(s.baseYen), 'n'), td(formatYen(s.taxYen), 'n'), td(formatYen(s.grossYen), 'n'))
    sum.append(tr)
  }
  const tot = document.createElement('tr')
  tot.append(th('合計'), td(formatYen(result.subtotalYen), 'n'), td(formatYen(result.taxYen), 'n'), td(formatYen(result.totalYen), 'n'))
  sum.append(tot)

  const nodes: Node[] = [title, head, issuer, totalBox, table]
  if (hasReduced) nodes.push(div('small', '※ は軽減税率（8%）対象の品目です。'))
  nodes.push(sum)
  if (iss.bankInfo) nodes.push(div('block', `【振込先】\n${iss.bankInfo}`))
  if (inv.note) nodes.push(div('block', `【備考】\n${inv.note}`))
  prev.replaceChildren(...nodes)

  const err = $('errors')
  err.replaceChildren()
  if (errors.length) {
    const ul = document.createElement('ul')
    for (const e of errors) {
      const li = document.createElement('li')
      li.textContent = e
      ul.append(li)
    }
    err.append(ul)
  }
  const warn = $('warning')
  if (!reg && errors.length === 0) {
    warn.textContent = '登録番号が未記入です。適格請求書としては使えません（免税事業者等の通常の請求書として発行する場合を除く）。'
    warn.classList.remove('hidden')
  } else {
    warn.classList.add('hidden')
  }
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (state.saved.length === 0) {
    const li = document.createElement('li')
    li.textContent = '（まだ保存した請求書はありません）'
    ul.append(li)
    return
  }
  for (const s of state.saved) {
    const li = document.createElement('li')
    const label = document.createElement('span')
    label.textContent = `${s.invoice.issueDate} / ${s.invoice.invoiceNumber || '番号なし'} / ${s.invoice.customerName || '宛名なし'}`
    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'secondary'
    open.textContent = '開く'
    open.dataset.action = 'open'
    open.dataset.id = s.id
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'danger'
    del.textContent = '削除'
    del.dataset.action = 'delete'
    del.dataset.id = s.id
    li.append(label, open, del)
    ul.append(li)
  }
}

function refresh(): void {
  readForm()
  const errors = validateInvoice(state.issuer, state.invoice)
  renderPreview(errors)
  persist()
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function currentErrors(): string[] {
  readForm()
  return validateInvoice(state.issuer, state.invoice)
}

function snapshot(): InvoiceInput {
  return JSON.parse(JSON.stringify(state.invoice)) as InvoiceInput
}

const form = $('form-col')
form.addEventListener('input', refresh)
form.addEventListener('change', refresh)

$('add-item').addEventListener('click', () => {
  readForm()
  state.invoice.items.push(emptyItem())
  renderItems()
  refresh()
})

$('items').addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  if (!t.classList.contains('it-del')) return
  readForm()
  const idx = Number((t.closest('.item') as HTMLElement).dataset.index)
  state.invoice.items.splice(idx, 1)
  if (state.invoice.items.length === 0) state.invoice.items.push(emptyItem())
  renderItems()
  refresh()
})

$('print').addEventListener('click', () => {
  const errors = currentErrors()
  renderPreview(errors)
  if (errors.length === 0) window.print()
})

$('export-csv').addEventListener('click', () => {
  const errors = currentErrors()
  renderPreview(errors)
  if (errors.length) return
  const result = calculateInvoice(state.invoice)
  download(buildCsvBlob(buildInvoiceCsv(state.invoice, result)), safeFileName('invoice', 'csv'))
})

$('save-invoice').addEventListener('click', () => {
  const errors = currentErrors()
  renderPreview(errors)
  if (errors.length) return
  const id = `inv-${Date.now()}`
  state.saved.unshift({ id, savedAt: new Date().toISOString(), invoice: snapshot() })
  persist()
  renderSaved()
})

$('saved-list').addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  const id = t.dataset.id
  if (!id) return
  const found = state.saved.find((s) => s.id === id)
  if (!found) return
  if (t.dataset.action === 'open') {
    state.invoice = JSON.parse(JSON.stringify(found.invoice))
    fillForm()
    refresh()
  } else if (t.dataset.action === 'delete') {
    state.saved = state.saved.filter((s) => s.id !== id)
    persist()
    renderSaved()
  }
})

$('new-invoice').addEventListener('click', () => {
  readForm()
  const fresh = loadFresh()
  state.invoice = fresh
  fillForm()
  refresh()
})

function loadFresh(): InvoiceInput {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { invoiceNumber: '', issueDate: today, dueDate: '', customerName: '', priceMode: state.invoice.priceMode, rounding: state.invoice.rounding, items: [emptyItem()], note: '' }
}

$('export-json').addEventListener('click', () => {
  readForm()
  download(stateToJsonBlob(state), safeFileName('invoice-maker-backup', 'json'))
})

$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())

$('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const msg = $('import-msg')
  if (!file) return
  try {
    const text = await file.text()
    state = parseStateFromJsonText(text)
    fillForm()
    renderSaved()
    refresh()
    msg.textContent = 'インポートしました。'
  } catch (err) {
    msg.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  }
  input.value = ''
})

fillForm()
renderSaved()
refresh()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
