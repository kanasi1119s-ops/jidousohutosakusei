import './style.css'
import {
  calculate,
  formatYen,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumber,
  validateDoc,
  type InvoiceDoc,
  type Item,
} from './calc'
import { docFileName, docToJsonBlob, emptyDoc, loadDoc, parseDocFromJsonText, saveDoc } from './storage'
import { buildCsvBlob } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
let doc: InvoiceDoc = loadDoc() ?? emptyDoc(todayStr)

app.innerHTML = `
  <h1>請求書・見積書メーカー</h1>
  <p class="subtitle">インボイス制度の記載事項（登録番号・税率ごとの消費税額）に沿った書類を作成し、印刷／PDF保存できます。</p>
  <div>
    <span class="badge">登録不要</span>
    <span class="badge">入力データは外部送信されません</span>
    <span class="badge">オフラインでも利用可能</span>
  </div>
  <form id="form" class="card" novalidate>
    <h2>書類情報</h2>
    <div class="grid">
      <div class="field"><label for="kind">書類の種類</label>
        <select id="kind"><option value="invoice">請求書</option><option value="quote">見積書</option></select></div>
      <div class="field"><label for="number">書類番号</label><input id="number" type="text" /></div>
      <div class="field"><label for="issueDate">発行日</label><input id="issueDate" type="date" /></div>
      <div class="field"><label for="dueDate">支払期限／有効期限</label><input id="dueDate" type="date" /></div>
    </div>
    <h2 style="margin-top:16px">発行者</h2>
    <div class="grid">
      <div class="field"><label for="issuerName">氏名・屋号・会社名</label><input id="issuerName" type="text" /></div>
      <div class="field"><label for="registrationNumber">適格請求書発行事業者の登録番号（T+13桁）</label><input id="registrationNumber" type="text" placeholder="T1234567890123" /></div>
    </div>
    <div class="field" style="margin-top:8px"><label for="issuerAddress">住所・連絡先</label><textarea id="issuerAddress" rows="2"></textarea></div>
    <h2 style="margin-top:16px">宛名</h2>
    <div class="field"><label for="clientName">請求先・見積先（御中・様は含めず入力）</label><input id="clientName" type="text" /></div>
    <h2 style="margin-top:16px">明細</h2>
    <div class="grid">
      <div class="field"><label for="taxMode">金額の入力方法</label>
        <select id="taxMode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select></div>
      <div class="field"><label for="rounding">端数処理</label>
        <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
    </div>
    <div id="items" style="margin-top:12px"></div>
    <button type="button" class="secondary" id="add-item">明細を追加</button>
    <h2 style="margin-top:16px">振込先・備考</h2>
    <div class="field"><label for="bank">振込先</label><textarea id="bank" rows="2"></textarea></div>
    <div class="field" style="margin-top:8px"><label for="notes">備考</label><textarea id="notes" rows="2"></textarea></div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="button" id="print">印刷／PDF保存</button>
      <button type="button" class="secondary" id="export-json">データをエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">データをインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">明細をCSVでダウンロード</button>
      <button type="button" class="secondary" id="reset">入力をクリア</button>
    </div>
    <p class="note">入力内容はこのブラウザ内（localStorage）にのみ保存されます。ブラウザのデータを消すと失われるため、JSONエクスポートでバックアップしてください。本ツールは一般的な書類作成の補助であり、税務上の適否を保証するものではありません。</p>
  </form>
  <section id="preview" aria-label="プレビュー"></section>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (text !== undefined) e.textContent = text
  if (cls) e.className = cls
  return e
}

function renderItemRows(): void {
  const box = $('items')
  box.replaceChildren()
  doc.items.forEach((it, i) => {
    const row = el('div', undefined, 'item-row')
    const mk = (label: string, input: HTMLElement, cls = '') => {
      const f = el('div', undefined, 'field ' + cls)
      f.append(el('label', label), input)
      return f
    }
    const name = el('input'); name.type = 'text'; name.value = it.name; name.dataset.f = 'name'; name.setAttribute('aria-label', `品名${i + 1}`)
    name.addEventListener('input', () => { it.name = name.value; sync() })
    const qty = el('input'); qty.type = 'text'; qty.inputMode = 'decimal'; qty.value = String(it.qty); qty.setAttribute('aria-label', `数量${i + 1}`)
    qty.addEventListener('input', () => { it.qty = parseNumber(qty.value); sync() })
    const price = el('input'); price.type = 'text'; price.inputMode = 'decimal'; price.value = String(it.unitPrice); price.setAttribute('aria-label', `単価${i + 1}`)
    price.addEventListener('input', () => { it.unitPrice = parseNumber(price.value); sync() })
    const rate = el('select'); rate.setAttribute('aria-label', `税率${i + 1}`)
    rate.innerHTML = '<option value="10">10%</option><option value="8">8%（軽減）</option>'
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => { it.taxRate = Number(rate.value) as Item['taxRate']; sync() })
    const del = el('button', '削除', 'secondary'); del.type = 'button'; del.setAttribute('aria-label', `明細${i + 1}を削除`)
    del.addEventListener('click', () => { doc.items.splice(i, 1); renderItemRows(); sync() })
    row.append(mk('品名', name, 'name'), mk('数量', qty), mk('単価（円）', price), mk('税率', rate), del)
    box.append(row)
  })
}

function bindText(id: string, get: () => string, set: (v: string) => void): void {
  const input = $<HTMLInputElement>(id)
  input.value = get()
  input.addEventListener('input', () => { set(input.value); sync() })
}

function renderPreview(): void {
  const pv = $('preview')
  pv.replaceChildren()
  const t = calculate(doc)
  const isInv = doc.kind === 'invoice'
  pv.append(el('h2', isInv ? '請 求 書' : '見 積 書'))
  const head = el('div', undefined, 'pv-head')
  const left = el('div')
  left.append(el('div', `${doc.clientName || '（宛名）'} 御中`, 'pv-client'))
  left.append(el('div', `${isInv ? 'ご請求金額' : 'お見積金額'}: ${formatYen(t.total)}（税込）`, 'pv-total'))
  if (doc.dueDate) left.append(el('div', `${isInv ? 'お支払期限' : '有効期限'}: ${doc.dueDate}`))
  const right = el('div')
  right.append(el('div', `${isInv ? '請求' : '見積'}番号: ${doc.number}`))
  right.append(el('div', `発行日: ${doc.issueDate}`))
  right.append(el('div', doc.issuer.name, 'pv-pre'))
  right.append(el('div', doc.issuer.address, 'pv-pre'))
  const reg = normalizeRegistrationNumber(doc.issuer.registrationNumber)
  if (reg) right.append(el('div', `登録番号: ${reg}`))
  head.append(left, right)
  pv.append(head)

  const table = el('table')
  const thead = el('thead'); const hr = el('tr')
  for (const h of ['品名', '数量', '単価', '税率', '金額']) hr.append(el('th', h))
  thead.append(hr); table.append(thead)
  const tb = el('tbody')
  doc.items.forEach((it, i) => {
    const tr = el('tr')
    tr.append(el('td', (it.name || '') + (it.taxRate === 8 ? ' ※軽減税率' : '')))
    tr.append(el('td', String(Number.isFinite(it.qty) ? it.qty : 0), 'num'))
    tr.append(el('td', formatYen(Number.isFinite(it.unitPrice) ? it.unitPrice : 0), 'num'))
    tr.append(el('td', `${it.taxRate}%`, 'num'))
    tr.append(el('td', formatYen(t.lineAmounts[i] ?? 0), 'num'))
    tb.append(tr)
  })
  table.append(tb)
  pv.append(table)

  const sum = el('table'); sum.style.width = '50%'; sum.style.marginLeft = 'auto'
  const addRow = (a: string, b: string) => { const tr = el('tr'); tr.append(el('th', a), el('td', b, 'num')); sum.append(tr) }
  for (const r of t.byRate) {
    const base = doc.taxMode === 'exclusive' ? r.subtotal : r.subtotal - r.tax
    addRow(`${r.rate}%対象${r.rate === 8 ? '（軽減）' : ''} 小計（税抜）`, formatYen(base))
    addRow(`${r.rate}%対象 消費税額`, formatYen(r.tax))
  }
  addRow('合計（税込）', formatYen(t.total))
  pv.append(sum)
  if (doc.bank.trim()) { pv.append(el('h3', '振込先')); pv.append(el('div', doc.bank, 'pv-pre')) }
  if (doc.notes.trim()) { pv.append(el('h3', '備考')); pv.append(el('div', doc.notes, 'pv-pre')) }
  pv.append(el('p', '※は軽減税率対象。消費税額は税率ごとに合計した金額から1回端数処理しています。', 'note'))
}

function sync(): void {
  saveDoc(doc)
  renderPreview()
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function showErrors(errors: string[]): void {
  $('errors').textContent = errors.join('\n')
}

function loadIntoForm(): void {
  $<HTMLSelectElement>('kind').value = doc.kind
  $<HTMLSelectElement>('taxMode').value = doc.taxMode
  $<HTMLSelectElement>('rounding').value = doc.rounding
  for (const [id, v] of Object.entries({
    number: doc.number, issueDate: doc.issueDate, dueDate: doc.dueDate, issuerName: doc.issuer.name,
    registrationNumber: doc.issuer.registrationNumber, issuerAddress: doc.issuer.address, clientName: doc.clientName,
    bank: doc.bank, notes: doc.notes,
  })) $<HTMLInputElement>(id).value = v
  renderItemRows()
  sync()
}

bindText('number', () => doc.number, (v) => (doc.number = v))
bindText('issueDate', () => doc.issueDate, (v) => (doc.issueDate = v))
bindText('dueDate', () => doc.dueDate, (v) => (doc.dueDate = v))
bindText('issuerName', () => doc.issuer.name, (v) => (doc.issuer.name = v))
bindText('registrationNumber', () => doc.issuer.registrationNumber, (v) => (doc.issuer.registrationNumber = v))
bindText('issuerAddress', () => doc.issuer.address, (v) => (doc.issuer.address = v))
bindText('clientName', () => doc.clientName, (v) => (doc.clientName = v))
bindText('bank', () => doc.bank, (v) => (doc.bank = v))
bindText('notes', () => doc.notes, (v) => (doc.notes = v))
for (const [id, set] of [
  ['kind', (v: string) => (doc.kind = v as InvoiceDoc['kind'])],
  ['taxMode', (v: string) => (doc.taxMode = v as InvoiceDoc['taxMode'])],
  ['rounding', (v: string) => (doc.rounding = v as InvoiceDoc['rounding'])],
] as const) {
  const s = $<HTMLSelectElement>(id)
  s.value = (doc as any)[id]
  s.addEventListener('change', () => { set(s.value); sync() })
}

$('add-item').addEventListener('click', () => {
  doc.items.push({ name: '', qty: 1, unitPrice: 0, taxRate: 10 })
  renderItemRows()
  sync()
})
$('print').addEventListener('click', () => {
  const errors = validateDoc(doc)
  showErrors(errors)
  if (errors.length === 0) window.print()
})
$('export-json').addEventListener('click', () => download(docToJsonBlob(doc), docFileName(doc, 'json')))
$('export-csv').addEventListener('click', () => download(buildCsvBlob(doc), docFileName(doc, 'csv')))
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$<HTMLInputElement>('import-file').addEventListener('change', async (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    doc = parseDocFromJsonText(await file.text())
    showErrors([])
    loadIntoForm()
  } catch (e) {
    showErrors([e instanceof Error ? e.message : 'インポートに失敗しました。'])
  }
  ;(ev.target as HTMLInputElement).value = ''
})
$('reset').addEventListener('click', () => {
  if (!confirm('入力内容をすべてクリアします。よろしいですか？')) return
  doc = emptyDoc(todayStr)
  showErrors([])
  loadIntoForm()
})
$('registrationNumber').addEventListener('blur', () => {
  const v = doc.issuer.registrationNumber
  if (v.trim() && !isValidRegistrationNumber(v)) showErrors(['登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。'])
  else showErrors([])
})
$('form').addEventListener('submit', (e) => e.preventDefault())

renderItemRows()
sync()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
