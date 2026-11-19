import './style.css'
import { calculate, formatYen, MAX_QUANTITY, MAX_UNIT_PRICE, parseNumber, type Item, type PriceMode, type Rounding, type TaxRate } from './calc'
import { defaultInvoice, emptyItem, safeFileStem, validateInvoice, type Invoice } from './model'
import { invoiceToJsonBlob, loadDraft, parseInvoiceJsonText, saveDraft } from './storage'
import { buildInvoiceCsvBlob } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <header class="no-print">
    <h1>請求書メーカー（インボイス対応）</h1>
    <p class="subtitle">登録不要・入力内容は端末の外に出ません。作成した請求書は印刷ダイアログから PDF として保存できます。</p>
    <div>
      <span class="badge">登録不要</span>
      <span class="badge">入力データは外部送信されません</span>
      <span class="badge">オフラインでも利用可能</span>
    </div>
  </header>
  <div class="layout">
    <form id="editor" class="no-print" novalidate>
      <fieldset>
        <legend>発行者（あなた）</legend>
        <label>氏名または名称<input type="text" id="issuerName" autocomplete="off" /></label>
        <label>登録番号（T + 13桁）<input type="text" id="regNo" placeholder="T1234567890123" autocomplete="off" /></label>
        <label>住所<input type="text" id="issuerAddress" autocomplete="off" /></label>
        <label>連絡先<input type="text" id="issuerContact" autocomplete="off" /></label>
      </fieldset>
      <fieldset>
        <legend>請求先・基本情報</legend>
        <label>宛名<input type="text" id="clientName" autocomplete="off" /></label>
        <label>敬称
          <select id="honorific"><option value="御中">御中</option><option value="様">様</option><option value="">なし</option></select>
        </label>
        <label>請求書番号（英数字）<input type="text" id="number" autocomplete="off" /></label>
        <label>発行日<input type="date" id="issueDate" /></label>
        <label>支払期限<input type="date" id="dueDate" /></label>
        <label>件名<input type="text" id="subject" autocomplete="off" /></label>
      </fieldset>
      <fieldset>
        <legend>計算方法</legend>
        <label>金額の入力方式
          <select id="priceMode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select>
        </label>
        <label>消費税の端数処理（税率ごとに1回）
          <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select>
        </label>
      </fieldset>
      <fieldset>
        <legend>明細</legend>
        <div id="items"></div>
        <button type="button" class="secondary" id="add-item">明細を追加</button>
      </fieldset>
      <fieldset>
        <legend>振込先・備考</legend>
        <label>振込先<textarea id="bank" rows="3"></textarea></label>
        <label>備考<textarea id="notes" rows="3"></textarea></label>
      </fieldset>
      <div class="warnings" id="warnings" role="status"></div>
      <div class="actions">
        <button type="button" id="print">PDF保存・印刷</button>
        <button type="button" class="secondary" id="export-csv">明細をCSVでダウンロード</button>
        <button type="button" class="secondary" id="export-json">バックアップ(JSON)</button>
        <button type="button" class="secondary" id="import-json">バックアップを読み込む</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
        <button type="button" class="secondary" id="new-invoice">新しい請求書（発行者情報は保持）</button>
      </div>
      <div class="errors" id="errors" role="alert"></div>
    </form>
    <section id="sheet" class="sheet" aria-label="請求書プレビュー"></section>
  </div>
  <div class="disclaimer no-print">
    <strong>免責事項:</strong>
    本ツールは請求書の作成を補助するものであり、税務・法律上の助言ではありません。適格請求書の記載要件・端数処理は
    国税庁の公表情報（インボイス制度に関するQ&amp;A）に基づく一般的な内容で、個別の取引への適用は専門家または税務署にご確認ください。
  </div>
  <footer class="no-print">入力データはこの端末のブラウザ内にのみ保存されます。「バックアップ(JSON)」で定期的に保存してください。</footer>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

let inv: Invoice = loadDraft() ?? defaultInvoice()
const invalidFields = new Set<string>()

function fillStatic(): void {
  $<HTMLInputElement>('issuerName').value = inv.issuer.name
  $<HTMLInputElement>('regNo').value = inv.issuer.registrationNumber
  $<HTMLInputElement>('issuerAddress').value = inv.issuer.address
  $<HTMLInputElement>('issuerContact').value = inv.issuer.contact
  $<HTMLInputElement>('clientName').value = inv.clientName
  $<HTMLSelectElement>('honorific').value = inv.honorific
  $<HTMLInputElement>('number').value = inv.number
  $<HTMLInputElement>('issueDate').value = inv.issueDate
  $<HTMLInputElement>('dueDate').value = inv.dueDate
  $<HTMLInputElement>('subject').value = inv.subject
  $<HTMLSelectElement>('priceMode').value = inv.priceMode
  $<HTMLSelectElement>('rounding').value = inv.rounding
  $<HTMLTextAreaElement>('bank').value = inv.bank
  $<HTMLTextAreaElement>('notes').value = inv.notes
}

function readStatic(): void {
  inv.issuer.name = $<HTMLInputElement>('issuerName').value
  inv.issuer.registrationNumber = $<HTMLInputElement>('regNo').value
  inv.issuer.address = $<HTMLInputElement>('issuerAddress').value
  inv.issuer.contact = $<HTMLInputElement>('issuerContact').value
  inv.clientName = $<HTMLInputElement>('clientName').value
  inv.honorific = $<HTMLSelectElement>('honorific').value
  inv.number = $<HTMLInputElement>('number').value
  inv.issueDate = $<HTMLInputElement>('issueDate').value
  inv.dueDate = $<HTMLInputElement>('dueDate').value
  inv.subject = $<HTMLInputElement>('subject').value
  inv.priceMode = $<HTMLSelectElement>('priceMode').value as PriceMode
  inv.rounding = $<HTMLSelectElement>('rounding').value as Rounding
  inv.bank = $<HTMLTextAreaElement>('bank').value
  inv.notes = $<HTMLTextAreaElement>('notes').value
}

function mk<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) if (v !== undefined) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}

function renderItemRows(): void {
  const box = $<HTMLDivElement>('items')
  box.replaceChildren()
  inv.items.forEach((it, i) => {
    const row = mk('div', { class: 'item-row', 'data-row': String(i) })
    const name = mk('input', { type: 'text', 'aria-label': `品名${i + 1}`, 'data-f': 'name', autocomplete: 'off' })
    name.value = it.name
    const qty = mk('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量${i + 1}`, 'data-f': 'quantity' })
    qty.value = String(it.quantity)
    const unit = mk('input', { type: 'text', 'aria-label': `単位${i + 1}`, 'data-f': 'unit', autocomplete: 'off' })
    unit.value = it.unit
    const price = mk('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価${i + 1}`, 'data-f': 'unitPrice' })
    price.value = String(it.unitPrice)
    const rate = mk('select', { 'aria-label': `税率${i + 1}`, 'data-f': 'taxRate' })
    for (const [v, l] of [['10', '10%'], ['8', '8%（軽減）'], ['0', '非課税・不課税']] as const) {
      const o = mk('option', { value: v }, l)
      rate.append(o)
    }
    rate.value = String(it.taxRate)
    const del = mk('button', { type: 'button', class: 'secondary small', 'data-del': String(i), 'aria-label': `明細${i + 1}を削除` }, '削除')
    row.append(name, qty, unit, price, rate, del)
    box.append(row)
  })
}

function onItemInput(target: HTMLElement): void {
  const row = target.closest<HTMLElement>('.item-row')
  const f = target.getAttribute('data-f')
  if (!row || !f) return
  const i = Number(row.getAttribute('data-row'))
  const it = inv.items[i]
  const v = (target as HTMLInputElement).value
  const key = `${i}:${f}`
  if (f === 'name' || f === 'unit') {
    it[f] = v
  } else if (f === 'taxRate') {
    it.taxRate = Number(v) as TaxRate
  } else {
    const n = parseNumber(v)
    const limit = f === 'quantity' ? MAX_QUANTITY : MAX_UNIT_PRICE
    if (n === null || Math.abs(n) > limit) {
      invalidFields.add(key)
      it[f as 'quantity' | 'unitPrice'] = 0
    } else {
      invalidFields.delete(key)
      it[f as 'quantity' | 'unitPrice'] = n
    }
  }
}

function dateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function renderSheet(): void {
  const sheet = $<HTMLElement>('sheet')
  const t = calculate(inv.items, inv.priceMode, inv.rounding)
  const incl = inv.priceMode === 'inclusive'
  const hasReduced = inv.items.some((it) => it.taxRate === 8 && it.name.trim() !== '')
  sheet.replaceChildren()

  sheet.append(mk('h2', { class: 'doc-title' }, '請求書'))

  const head = mk('div', { class: 'doc-head' })
  const left = mk('div', { class: 'doc-client' })
  const clientLine = (inv.clientName.trim() === '' ? '（宛名未入力）' : inv.clientName) + (inv.clientName.trim() ? ' ' + inv.honorific : '')
  left.append(mk('div', { class: 'client-name', 'data-t': 'client' }, clientLine))
  if (inv.subject.trim()) left.append(mk('div', {}, `件名: ${inv.subject}`))
  const right = mk('div', { class: 'doc-meta' })
  if (inv.number.trim()) right.append(mk('div', {}, `請求書番号: ${inv.number}`))
  if (inv.issueDate) right.append(mk('div', {}, `発行日: ${dateJa(inv.issueDate)}`))
  if (inv.dueDate) right.append(mk('div', {}, `支払期限: ${dateJa(inv.dueDate)}`))
  head.append(left, right)
  sheet.append(head)

  const issuer = mk('div', { class: 'doc-issuer' })
  if (inv.issuer.name.trim()) issuer.append(mk('div', { class: 'issuer-name' }, inv.issuer.name))
  if (inv.issuer.registrationNumber.trim()) issuer.append(mk('div', {}, `登録番号: ${inv.issuer.registrationNumber}`))
  if (inv.issuer.address.trim()) issuer.append(mk('div', {}, inv.issuer.address))
  if (inv.issuer.contact.trim()) issuer.append(mk('div', {}, inv.issuer.contact))
  sheet.append(issuer)

  const total = mk('div', { class: 'doc-total' })
  total.append(mk('span', {}, 'ご請求金額（税込）'), mk('strong', { id: 'grand-total' }, formatYen(t.grandTotal)))
  sheet.append(total)

  const table = mk('table', { class: 'doc-table' })
  const thead = mk('thead')
  const hr = mk('tr')
  for (const h of ['品名', '数量', '単価', '税率', incl ? '金額（税込）' : '金額（税抜）']) hr.append(mk('th', {}, h))
  thead.append(hr)
  const tbody = mk('tbody')
  inv.items.forEach((it: Item, i) => {
    if (it.name.trim() === '' && it.unitPrice === 0) return
    const tr = mk('tr')
    const reduced = it.taxRate === 8 ? '※' : ''
    tr.append(
      mk('td', {}, it.name + reduced),
      mk('td', { class: 'num' }, `${it.quantity}${it.unit}`),
      mk('td', { class: 'num' }, it.unitPrice.toLocaleString('ja-JP')),
      mk('td', { class: 'num' }, it.taxRate === 0 ? '非課税' : `${it.taxRate}%`),
      mk('td', { class: 'num' }, t.lineAmounts[i].toLocaleString('ja-JP')),
    )
    tbody.append(tr)
  })
  table.append(thead, tbody)
  sheet.append(table)

  const sum = mk('table', { class: 'doc-sum' })
  for (const g of t.groups) {
    const label = g.rate === 0 ? '非課税・不課税対象' : `${g.rate}%対象`
    const tr = mk('tr', { 'data-rate': String(g.rate) })
    if (g.rate === 0) {
      tr.append(mk('th', {}, label), mk('td', { class: 'num' }, formatYen(g.amount)))
    } else if (incl) {
      tr.append(mk('th', {}, `${label} 税込合計`), mk('td', { class: 'num' }, `${formatYen(g.amount)}（内消費税 ${formatYen(g.tax)}）`))
    } else {
      tr.append(mk('th', {}, `${label} 税抜合計`), mk('td', { class: 'num' }, `${formatYen(g.amount)}　消費税 ${formatYen(g.tax)}`))
    }
    sum.append(tr)
  }
  sheet.append(sum)
  if (hasReduced) sheet.append(mk('p', { class: 'doc-note' }, '※ は軽減税率（8%）対象の品目です。'))
  if (inv.bank.trim()) {
    sheet.append(mk('h3', {}, '振込先'), mk('p', { class: 'pre' }, inv.bank))
  }
  if (inv.notes.trim()) {
    sheet.append(mk('h3', {}, '備考'), mk('p', { class: 'pre' }, inv.notes))
  }
}

function refresh(save = true): void {
  renderSheet()
  const warns = validateInvoice(inv)
  for (const k of invalidFields) {
    const [i, f] = k.split(':')
    warns.push(
      f === 'quantity'
        ? `明細${Number(i) + 1}の数量が数値でないか範囲外です（±${MAX_QUANTITY.toLocaleString('ja-JP')}まで。0として扱います）。`
        : `明細${Number(i) + 1}の単価が数値でないか範囲外です（±${MAX_UNIT_PRICE.toLocaleString('ja-JP')}円まで。0として扱います）。`,
    )
  }
  const box = $<HTMLElement>('warnings')
  box.replaceChildren(...warns.map((w) => mk('div', {}, w)))
  if (save) saveDraft(inv)
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const editor = $<HTMLFormElement>('editor')
editor.addEventListener('submit', (e) => e.preventDefault())
editor.addEventListener('input', (e) => {
  const target = e.target as HTMLElement
  if (target.closest('.item-row')) onItemInput(target)
  else readStatic()
  refresh()
})
editor.addEventListener('change', (e) => {
  const target = e.target as HTMLElement
  if (target.closest('.item-row')) onItemInput(target)
  else readStatic()
  refresh()
})
$('items').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')
  if (!btn) return
  inv.items.splice(Number(btn.getAttribute('data-del')), 1)
  if (inv.items.length === 0) inv.items.push(emptyItem())
  invalidFields.clear()
  renderItemRows()
  refresh()
})
$('add-item').addEventListener('click', () => {
  if (inv.items.length >= 500) return
  inv.items.push(emptyItem())
  renderItemRows()
  refresh()
})
$('print').addEventListener('click', () => {
  const prev = document.title
  document.title = safeFileStem(inv.number, inv.issueDate)
  window.print()
  document.title = prev
})
$('export-csv').addEventListener('click', () => {
  download(buildInvoiceCsvBlob(inv), safeFileStem(inv.number, inv.issueDate) + '.csv')
})
$('export-json').addEventListener('click', () => {
  download(invoiceToJsonBlob(inv), safeFileStem(inv.number, inv.issueDate) + '.json')
})
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const errEl = $<HTMLElement>('errors')
  if (!file) return
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('ファイルが大きすぎます（上限5MB）。')
    inv = parseInvoiceJsonText(await file.text())
    invalidFields.clear()
    errEl.textContent = ''
    fillStatic()
    renderItemRows()
    refresh()
  } catch (err) {
    errEl.textContent = err instanceof Error ? err.message : '読み込みに失敗しました。'
  } finally {
    input.value = ''
  }
})
$('new-invoice').addEventListener('click', () => {
  const fresh = defaultInvoice()
  fresh.issuer = inv.issuer
  fresh.bank = inv.bank
  fresh.priceMode = inv.priceMode
  fresh.rounding = inv.rounding
  inv = fresh
  invalidFields.clear()
  fillStatic()
  renderItemRows()
  refresh()
})

fillStatic()
renderItemRows()
refresh(false)

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
