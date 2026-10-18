import './style.css'
import { computeTotals, formatYen, parseNumber, type LineItem, type PriceMode, type Rounding, type TaxRate } from './calc'
import {
  KIND_LABELS,
  emptyDoc,
  emptyIssuer,
  formatDateJa,
  newId,
  nextNumber,
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
  validateDocument,
  todayIso,
  type DocKind,
  type InvoiceDoc,
  type Issuer,
} from './invoice'
import {
  backupFileName,
  backupToBlob,
  buildBackup,
  loadDocuments,
  loadDraft,
  loadIssuer,
  parseBackup,
  saveDocuments,
  saveDraft,
  saveIssuer,
} from './storage'
import { buildItemsCsvBlob, csvFileName } from './csv'

type Child = Node | string | null | undefined
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) {
    if (c === null || c === undefined) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

let issuer: Issuer = loadIssuer()
let doc: InvoiceDoc = loadDraft() ?? emptyDoc()
let documents: InvoiceDoc[] = loadDocuments()

app.innerHTML = `
  <header class="site-header no-print">
    <h1>インボイス対応 請求書メーカー</h1>
    <p class="subtitle">適格請求書の記載事項に沿って、請求書・見積書・納品書・領収書を作成し、印刷／PDF保存できます。</p>
    <div>
      <span class="privacy-badge">登録不要</span>
      <span class="privacy-badge">入力データは外部送信されません</span>
      <span class="privacy-badge">オフラインでも利用可能</span>
    </div>
  </header>
  <div class="layout">
    <section class="editor no-print" aria-label="入力フォーム">
      <fieldset>
        <legend>発行者情報（この端末のブラウザに保存されます）</legend>
        <div class="field"><label for="issuer-name">氏名または名称</label><input id="issuer-name" type="text" autocomplete="off" /></div>
        <div class="field"><label for="issuer-reg">登録番号（T+数字13桁）</label><input id="issuer-reg" type="text" placeholder="T1234567890123" autocomplete="off" /></div>
        <div class="field"><label for="issuer-address">住所</label><input id="issuer-address" type="text" autocomplete="off" /></div>
        <div class="field"><label for="issuer-contact">連絡先（電話・メール）</label><input id="issuer-contact" type="text" autocomplete="off" /></div>
      </fieldset>
      <fieldset>
        <legend>書類情報</legend>
        <div class="field"><label for="doc-kind">書類の種類</label>
          <select id="doc-kind">
            <option value="invoice">請求書</option><option value="quote">見積書</option>
            <option value="delivery">納品書</option><option value="receipt">領収書</option>
          </select></div>
        <div class="field"><label for="doc-number">書類番号</label><input id="doc-number" type="text" placeholder="INV-2026-0001" autocomplete="off" /></div>
        <div class="field"><label for="doc-issue">発行日</label><input id="doc-issue" type="date" /></div>
        <div class="field"><label for="doc-trans">取引年月日（期間可。例: 2026年10月分）</label><input id="doc-trans" type="text" autocomplete="off" /></div>
        <div class="field"><label for="doc-due">支払期限（任意）</label><input id="doc-due" type="date" /></div>
        <div class="field"><label for="doc-client">宛名（取引先名）</label><input id="doc-client" type="text" autocomplete="off" /></div>
        <div class="field"><label for="doc-honorific">敬称</label>
          <select id="doc-honorific"><option value="御中">御中</option><option value="様">様</option><option value="">なし</option></select></div>
        <div class="field"><label for="doc-subject">件名（任意）</label><input id="doc-subject" type="text" autocomplete="off" /></div>
      </fieldset>
      <fieldset>
        <legend>明細</legend>
        <div class="options">
          <div class="field"><label for="doc-pricemode">金額の入力方法</label>
            <select id="doc-pricemode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select></div>
          <div class="field"><label for="doc-rounding">端数処理</label>
            <select id="doc-rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
        </div>
        <div id="items" class="items"></div>
        <button type="button" id="add-item">明細を追加</button>
      </fieldset>
      <fieldset>
        <legend>振込先・備考</legend>
        <div class="field"><label for="doc-bank">振込先（任意）</label><textarea id="doc-bank" rows="3"></textarea></div>
        <div class="field"><label for="doc-notes">備考（任意）</label><textarea id="doc-notes" rows="3"></textarea></div>
      </fieldset>
      <div id="errors" class="errors" role="alert"></div>
      <div id="warnings" class="warnings"></div>
      <div class="actions">
        <button type="button" id="print" class="primary">印刷 / PDF保存</button>
        <button type="button" id="save-doc">この書類を保存</button>
        <button type="button" id="new-doc">新しい書類（番号を繰り上げ）</button>
        <button type="button" id="export-csv">明細をCSVで保存</button>
      </div>
      <div id="status" class="status" role="status"></div>
      <fieldset>
        <legend>保存済みの書類</legend>
        <ul id="saved-list" class="saved-list"></ul>
        <div class="actions">
          <button type="button" id="export-json">バックアップ（JSON）を保存</button>
          <label class="file-button">バックアップを読み込む<input id="import-json" type="file" accept="application/json,.json" /></label>
        </div>
      </fieldset>
      <p class="disclaimer">本ツールは書類作成の補助であり、税務・法律上の助言ではありません。適格請求書の要件や税率・経過措置は国税庁の最新情報をご確認ください。入力データはこの端末のブラウザ内にのみ保存され、サーバーには送信されません（ブラウザのデータを消去すると失われるため、定期的にバックアップを保存してください）。</p>
    </section>
    <section class="preview-wrap" aria-label="プレビュー">
      <div id="preview" class="paper"></div>
    </section>
  </div>
`

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

function setStatus(message: string): void {
  $('status').textContent = message
}

function itemRow(index: number, item: LineItem): HTMLElement {
  const row = h('div', { class: 'item-row', 'data-index': String(index) })
  const name = h('input', { type: 'text', 'aria-label': `品名${index + 1}`, class: 'item-name', autocomplete: 'off' })
  name.value = item.name
  const qty = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量${index + 1}`, class: 'item-qty' })
  qty.value = String(item.quantity)
  const price = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': `単価${index + 1}`, class: 'item-price' })
  price.value = String(item.unitPriceYen)
  const rate = h('select', { 'aria-label': `税率${index + 1}`, class: 'item-rate' })
  rate.append(h('option', { value: '10' }, '10%'), h('option', { value: '8' }, '8%（軽減）'))
  rate.value = String(item.taxRate)
  const remove = h('button', { type: 'button', class: 'remove-item', 'aria-label': `明細${index + 1}を削除` }, '削除')

  const update = (): void => {
    const q = parseNumber(qty.value)
    const p = parseNumber(price.value)
    doc.items[index] = {
      name: name.value,
      quantity: q === null ? NaN : q,
      unitPriceYen: p === null ? NaN : p,
      taxRate: (rate.value === '8' ? 8 : 10) as TaxRate,
    }
    refresh()
  }
  for (const el of [name, qty, price]) el.addEventListener('input', update)
  rate.addEventListener('change', update)
  remove.addEventListener('click', () => {
    doc.items.splice(index, 1)
    if (doc.items.length === 0) doc.items.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
    renderItems()
    refresh()
  })

  row.append(
    h('label', {}, '品名', name),
    h('label', {}, '数量', qty),
    h('label', {}, '単価（円）', price),
    h('label', {}, '税率', rate),
    remove,
  )
  return row
}

function renderItems(): void {
  const wrap = $('items')
  wrap.replaceChildren(...doc.items.map((it, i) => itemRow(i, it)))
}

function fillForm(): void {
  $<HTMLInputElement>('issuer-name').value = issuer.name
  $<HTMLInputElement>('issuer-reg').value = issuer.registrationNumber
  $<HTMLInputElement>('issuer-address').value = issuer.address
  $<HTMLInputElement>('issuer-contact').value = issuer.contact
  $<HTMLSelectElement>('doc-kind').value = doc.kind
  $<HTMLInputElement>('doc-number').value = doc.number
  $<HTMLInputElement>('doc-issue').value = doc.issueDate
  $<HTMLInputElement>('doc-trans').value = doc.transactionDate
  $<HTMLInputElement>('doc-due').value = doc.dueDate
  $<HTMLInputElement>('doc-client').value = doc.clientName
  $<HTMLSelectElement>('doc-honorific').value = doc.honorific
  $<HTMLInputElement>('doc-subject').value = doc.subject
  $<HTMLSelectElement>('doc-pricemode').value = doc.priceMode
  $<HTMLSelectElement>('doc-rounding').value = doc.rounding
  $<HTMLTextAreaElement>('doc-bank').value = doc.bankInfo
  $<HTMLTextAreaElement>('doc-notes').value = doc.notes
  renderItems()
}

function readForm(): void {
  issuer = {
    name: $<HTMLInputElement>('issuer-name').value,
    registrationNumber: $<HTMLInputElement>('issuer-reg').value,
    address: $<HTMLInputElement>('issuer-address').value,
    contact: $<HTMLInputElement>('issuer-contact').value,
  }
  doc.kind = $<HTMLSelectElement>('doc-kind').value as DocKind
  doc.number = $<HTMLInputElement>('doc-number').value
  doc.issueDate = $<HTMLInputElement>('doc-issue').value
  doc.transactionDate = $<HTMLInputElement>('doc-trans').value
  doc.dueDate = $<HTMLInputElement>('doc-due').value
  doc.clientName = $<HTMLInputElement>('doc-client').value
  doc.honorific = $<HTMLSelectElement>('doc-honorific').value
  doc.subject = $<HTMLInputElement>('doc-subject').value
  doc.priceMode = $<HTMLSelectElement>('doc-pricemode').value as PriceMode
  doc.rounding = $<HTMLSelectElement>('doc-rounding').value as Rounding
  doc.bankInfo = $<HTMLTextAreaElement>('doc-bank').value
  doc.notes = $<HTMLTextAreaElement>('doc-notes').value
}

function multiline(text: string): Node[] {
  const out: Node[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (i > 0) out.push(document.createElement('br'))
    out.push(document.createTextNode(line))
  })
  return out
}

function visibleItems(): LineItem[] {
  return doc.items.filter((it) => it.name.trim() !== '' && Number.isFinite(it.quantity) && Number.isFinite(it.unitPriceYen))
}

function currentTotals() {
  return computeTotals(visibleItems(), doc.priceMode, doc.rounding)
}

function renderPreview(): void {
  const visible = visibleItems()
  const totals = currentTotals()
  const title = KIND_LABELS[doc.kind]
  const hasReduced = visible.some((it) => it.taxRate === 8)
  const reg = issuer.registrationNumber.trim() !== '' && isValidRegistrationNumber(issuer.registrationNumber)
    ? normalizeRegistrationNumber(issuer.registrationNumber)
    : ''

  const meta = h('div', { class: 'p-meta' })
  if (doc.number) meta.append(h('div', {}, `書類番号: ${doc.number}`))
  const issued = formatDateJa(doc.issueDate)
  if (issued) meta.append(h('div', {}, `発行日: ${issued}`))
  if (doc.transactionDate.trim()) meta.append(h('div', { id: 'p-trans' }, `取引年月日: ${doc.transactionDate.trim()}`))
  const due = formatDateJa(doc.dueDate)
  if (due && doc.kind === 'invoice') meta.append(h('div', {}, `支払期限: ${due}`))

  const issuerBox = h('div', { class: 'p-issuer' })
  if (issuer.name) issuerBox.append(h('div', { class: 'p-issuer-name' }, issuer.name))
  if (reg) issuerBox.append(h('div', {}, `登録番号: ${reg}`))
  if (issuer.address) issuerBox.append(h('div', {}, ...multiline(issuer.address)))
  if (issuer.contact) issuerBox.append(h('div', {}, ...multiline(issuer.contact)))

  const tbody = h('tbody')
  visible.forEach((it, i) => {
    tbody.append(
      h(
        'tr',
        {},
        h('td', {}, it.taxRate === 8 ? `${it.name} ※` : it.name),
        h('td', { class: 'num' }, String(it.quantity)),
        h('td', { class: 'num' }, formatYen(it.unitPriceYen)),
        h('td', { class: 'num' }, `${it.taxRate}%`),
        h('td', { class: 'num' }, formatYen(totals.lineAmounts[i])),
      ),
    )
  })
  const amountHead = doc.priceMode === 'inclusive' ? '金額（税込）' : '金額（税抜）'

  const summaryBody = h('tbody')
  for (const r of totals.byRate) {
    summaryBody.append(
      h(
        'tr',
        {},
        h('td', {}, `${r.rate}%対象${r.rate === 8 ? '（軽減税率）' : ''}`),
        h('td', { class: 'num' }, formatYen(r.base)),
        h('td', { class: 'num' }, formatYen(r.tax)),
        h('td', { class: 'num' }, formatYen(r.total)),
      ),
    )
  }

  const paper = $('preview')
  const parts: Child[] = [
    h('h2', { class: 'p-title' }, title),
    meta,
    h(
      'div',
      { class: 'p-head' },
      h('div', { class: 'p-client' }, h('span', { class: 'p-client-name' }, doc.clientName ? `${doc.clientName} ${doc.honorific}`.trim() : '（宛名未入力）')),
      issuerBox,
    ),
    doc.subject ? h('div', { class: 'p-subject' }, `件名: ${doc.subject}`) : null,
    h('div', { class: 'p-total', id: 'grand-total' }, `${doc.kind === 'receipt' ? '領収金額' : doc.kind === 'quote' ? '御見積金額' : doc.kind === 'delivery' ? '合計金額' : 'ご請求金額'}（税込）: ${formatYen(totals.total)}`),
    doc.kind === 'receipt' ? h('div', { class: 'p-receipt-note' }, '上記正に領収いたしました。') : null,
    h(
      'table',
      { class: 'p-items' },
      h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', {}, '数量'), h('th', {}, '単価'), h('th', {}, '税率'), h('th', {}, amountHead))),
      tbody,
    ),
    hasReduced ? h('div', { class: 'p-note' }, '※は軽減税率（8%）対象品目です。') : null,
    h(
      'table',
      { class: 'p-summary', id: 'tax-summary' },
      h('thead', {}, h('tr', {}, h('th', {}, '税率区分'), h('th', {}, '税抜金額'), h('th', {}, '消費税額'), h('th', {}, '税込金額'))),
      summaryBody,
      h('tfoot', {}, h('tr', {}, h('th', {}, '合計'), h('td', { class: 'num' }, formatYen(totals.subtotal)), h('td', { class: 'num' }, formatYen(totals.tax)), h('td', { class: 'num' }, formatYen(totals.total)))),
    ),
    doc.bankInfo ? h('div', { class: 'p-block' }, h('strong', {}, '振込先'), h('div', {}, ...multiline(doc.bankInfo))) : null,
    doc.notes ? h('div', { class: 'p-block' }, h('strong', {}, '備考'), h('div', {}, ...multiline(doc.notes))) : null,
  ]
  paper.replaceChildren(...parts.filter((c): c is Node | string => c !== null && c !== undefined))
}

function renderSavedList(): void {
  const list = $('saved-list')
  if (documents.length === 0) {
    list.replaceChildren(h('li', { class: 'empty' }, '保存済みの書類はありません。'))
    return
  }
  const sorted = [...documents].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  list.replaceChildren(
    ...sorted.map((d) => {
      const label = `${KIND_LABELS[d.kind]} ${d.number || '(番号なし)'} / ${d.clientName || '(宛名なし)'} / ${formatDateJa(d.issueDate)}`
      const open = h('button', { type: 'button', class: 'open-doc' }, label)
      open.addEventListener('click', () => {
        doc = sanitizeCopy(d)
        fillForm()
        refresh()
        setStatus('保存済みの書類を読み込みました。')
      })
      const del = h('button', { type: 'button', class: 'delete-doc', 'aria-label': `${label}を削除` }, '削除')
      del.addEventListener('click', () => {
        if (!window.confirm('この書類を削除します。よろしいですか？')) return
        documents = documents.filter((x) => x.id !== d.id)
        persistDocuments()
        renderSavedList()
        setStatus('削除しました。')
      })
      return h('li', {}, open, del)
    }),
  )
}

function sanitizeCopy(d: InvoiceDoc): InvoiceDoc {
  return JSON.parse(JSON.stringify(d)) as InvoiceDoc
}

function persistDocuments(): void {
  if (!saveDocuments(documents)) setStatus('ブラウザに保存できませんでした。バックアップ（JSON）の保存をおすすめします。')
}

let draftTimer: number | undefined
function refresh(): void {
  readForm()
  const v = validateDocument(doc, issuer)
  $('errors').replaceChildren(...v.errors.map((e) => h('div', {}, e)))
  $('warnings').replaceChildren(...v.warnings.map((w) => h('div', {}, w)))
  renderPreview()
  window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(() => {
    saveIssuer(issuer)
    saveDraft(doc)
  }, 300)
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function guardValid(): boolean {
  refresh()
  const v = validateDocument(doc, issuer)
  if (v.errors.length > 0) {
    setStatus('入力内容にエラーがあります。上のメッセージを確認してください。')
    return false
  }
  return true
}

for (const id of [
  'issuer-name', 'issuer-reg', 'issuer-address', 'issuer-contact', 'doc-number', 'doc-issue', 'doc-trans', 'doc-due',
  'doc-client', 'doc-subject', 'doc-bank', 'doc-notes',
]) {
  $(id).addEventListener('input', refresh)
}
for (const id of ['doc-kind', 'doc-honorific', 'doc-pricemode', 'doc-rounding']) {
  $(id).addEventListener('change', refresh)
}

$('add-item').addEventListener('click', () => {
  doc.items.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
  renderItems()
  refresh()
})

$('print').addEventListener('click', () => {
  if (!guardValid()) return
  window.print()
})

$('save-doc').addEventListener('click', () => {
  if (!guardValid()) return
  doc.updatedAt = new Date().toISOString()
  const copy = sanitizeCopy(doc)
  const idx = documents.findIndex((d) => d.id === copy.id)
  if (idx >= 0) documents[idx] = copy
  else documents.push(copy)
  persistDocuments()
  renderSavedList()
  setStatus('この端末のブラウザに保存しました。')
})

$('new-doc').addEventListener('click', () => {
  readForm()
  const fresh = emptyDoc()
  fresh.kind = doc.kind
  fresh.number = nextNumber(doc.number)
  fresh.honorific = doc.honorific
  fresh.priceMode = doc.priceMode
  fresh.rounding = doc.rounding
  fresh.bankInfo = doc.bankInfo
  fresh.issueDate = todayIso()
  doc = fresh
  fillForm()
  refresh()
  setStatus('新しい書類を開始しました（番号を繰り上げました）。')
})

$('export-csv').addEventListener('click', () => {
  if (!guardValid()) return
  download(buildItemsCsvBlob(doc, currentTotals()), csvFileName(doc))
})

$('export-json').addEventListener('click', () => {
  readForm()
  saveIssuer(issuer)
  download(backupToBlob(buildBackup(issuer, documents)), backupFileName(todayIso()))
})

$<HTMLInputElement>('import-json').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const backup = parseBackup(await file.text())
    issuer = backup.issuer
    const byId = new Map(documents.map((d) => [d.id, d]))
    for (const d of backup.documents) byId.set(d.id, d)
    documents = [...byId.values()]
    saveIssuer(issuer)
    persistDocuments()
    fillForm()
    refresh()
    renderSavedList()
    setStatus(`バックアップを読み込みました（書類${backup.documents.length}件）。`)
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '読み込みに失敗しました。')
  } finally {
    input.value = ''
  }
})

if (!issuer.name && !issuer.registrationNumber) issuer = emptyIssuer()
if (doc.id === '') doc.id = newId()
fillForm()
refresh()
renderSavedList()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応が無効でも本機能は動作する
    })
  })
}
