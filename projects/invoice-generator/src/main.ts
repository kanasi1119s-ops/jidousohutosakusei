import './style.css'
import {
  computeTotals,
  formatYen,
  isValidRegistrationNumber,
  lineAmountYen,
  nextInvoiceNumber,
  normalizeRegistrationNumber,
  parseNumberInput,
  validateInvoiceForIssue,
} from './calc'
import { buildInvoiceCsvBlob, safeFileName } from './csv'
import { dataToJsonBlob, loadData, parseDataFromJsonText, saveData } from './storage'
import type { AppData, Invoice, Issuer, LineItem, Rounding, TaxRate } from './types'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>インボイス請求書ジェネレーター</h1>
  <p class="subtitle">適格請求書の記載事項に沿った請求書を作成し、PDFまたはCSVで保存できます。</p>
  <div>
    <span class="badge">登録不要</span>
    <span class="badge">入力データは外部送信されません</span>
    <span class="badge">オフラインでも利用可能</span>
  </div>

  <section class="card" aria-labelledby="h-issuer">
    <h2 id="h-issuer">発行者情報（この端末に保存されます）</h2>
    <div class="grid">
      <div class="field"><label for="issuer-name">氏名または名称</label><input id="issuer-name" autocomplete="off" /></div>
      <div class="field"><label for="issuer-reg">登録番号（T+数字13桁）</label><input id="issuer-reg" placeholder="T1234567890123" autocomplete="off" /></div>
      <div class="field wide"><label for="issuer-address">住所</label><input id="issuer-address" autocomplete="off" /></div>
      <div class="field wide"><label for="issuer-contact">連絡先（電話・メール）</label><input id="issuer-contact" autocomplete="off" /></div>
      <div class="field wide"><label for="issuer-bank">振込先</label><textarea id="issuer-bank"></textarea></div>
    </div>
  </section>

  <section class="card" aria-labelledby="h-invoice">
    <h2 id="h-invoice">請求内容</h2>
    <div class="grid">
      <div class="field"><label for="inv-number">請求書番号</label><input id="inv-number" autocomplete="off" /></div>
      <div class="field"><label for="inv-issue">請求日（取引年月日）</label><input id="inv-issue" type="date" /></div>
      <div class="field"><label for="inv-due">支払期限</label><input id="inv-due" type="date" /></div>
      <div class="field"><label for="inv-client">請求先（御中）</label><input id="inv-client" autocomplete="off" /></div>
      <div class="field">
        <label for="inv-rounding">消費税の端数処理（税率ごとに1回）</label>
        <select id="inv-rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select>
      </div>
      <div class="field check"><input id="inv-withholding" type="checkbox" /><label for="inv-withholding">報酬の源泉徴収税を差し引く（10.21%／100万円超は超過分20.42%）</label></div>
    </div>
    <h2 style="margin-top:16px">明細（金額は税抜）</h2>
    <table class="items">
      <thead><tr><th>品名</th><th>数量</th><th>単価(円)</th><th>税率</th><th>金額</th><th></th></tr></thead>
      <tbody id="item-rows"></tbody>
    </table>
    <div class="actions"><button type="button" id="add-row">明細を追加</button></div>
    <div class="grid" style="margin-top:12px"><div class="field wide"><label for="inv-notes">備考</label><textarea id="inv-notes"></textarea></div></div>
    <ul id="errors" role="alert"></ul>
    <p id="status" role="status"></p>
    <div class="actions">
      <button type="button" class="primary" id="save">請求書を保存</button>
      <button type="button" id="print">PDFで保存（印刷）</button>
      <button type="button" id="export-csv">CSVダウンロード</button>
      <button type="button" id="new-invoice">新しい請求書</button>
    </div>
    <p class="note">「PDFで保存（印刷）」を押すと、ブラウザの印刷画面で送信先を「PDFに保存」にするとPDFファイルになります。</p>
  </section>

  <section class="card" aria-labelledby="h-saved">
    <h2 id="h-saved">保存済みの請求書</h2>
    <ul id="saved-list"></ul>
    <p id="saved-empty" class="note">まだ保存された請求書はありません。</p>
    <div class="actions">
      <button type="button" id="export-json">全データをJSONで書き出し（バックアップ）</button>
      <button type="button" id="import-json">JSONを読み込み</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden />
    </div>
    <p class="note">データはこの端末のブラウザ内にのみ保存されます。端末の変更やブラウザのデータ削除に備えて、定期的にバックアップしてください。</p>
  </section>

  <section class="card" id="sheet-wrap" aria-labelledby="h-preview">
    <h2 id="h-preview">プレビュー</h2>
    <div id="sheet"></div>
  </section>

  <p class="note">本ツールは請求書作成の補助です。税務上の取り扱いは国税庁の公表資料または税理士等の専門家にご確認ください。登録番号の実在確認は国税庁「適格請求書発行事業者公表サイト」で行ってください。</p>
`

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

let data: AppData = loadData()
let currentId = newId()

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

// ---- 明細行 ----
function addRow(item?: LineItem): void {
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td><input class="r-name" aria-label="品名" autocomplete="off" /></td>
    <td><input class="r-qty" aria-label="数量" inputmode="decimal" autocomplete="off" style="width:5em" /></td>
    <td><input class="r-price" aria-label="単価" inputmode="decimal" autocomplete="off" style="width:8em" /></td>
    <td><select class="r-rate" aria-label="税率"><option value="10">10%</option><option value="8">8%（軽減）</option></select></td>
    <td class="amount r-amount">¥0</td>
    <td><button type="button" class="r-del" aria-label="この明細を削除">×</button></td>`
  if (item) {
    ;(tr.querySelector('.r-name') as HTMLInputElement).value = item.name
    ;(tr.querySelector('.r-qty') as HTMLInputElement).value = String(item.quantity)
    ;(tr.querySelector('.r-price') as HTMLInputElement).value = String(item.unitPriceYen)
    ;(tr.querySelector('.r-rate') as HTMLSelectElement).value = String(item.taxRate)
  } else {
    ;(tr.querySelector('.r-qty') as HTMLInputElement).value = '1'
  }
  tr.querySelector('.r-del')?.addEventListener('click', () => {
    tr.remove()
    refresh()
  })
  $('item-rows').appendChild(tr)
}

interface FormState {
  invoice: Invoice
  issuer: Issuer
  badNumberRows: number[]
}

function readForm(): FormState {
  const items: LineItem[] = []
  const badNumberRows: number[] = []
  Array.from($('item-rows').children).forEach((tr) => {
    const name = (tr.querySelector('.r-name') as HTMLInputElement).value.trim()
    const qtyText = (tr.querySelector('.r-qty') as HTMLInputElement).value
    const priceText = (tr.querySelector('.r-price') as HTMLInputElement).value
    if (!name && !priceText.trim()) return // 空行は無視
    const quantity = parseNumberInput(qtyText)
    const unitPriceYen = parseNumberInput(priceText)
    if (Number.isNaN(quantity) || Number.isNaN(unitPriceYen)) badNumberRows.push(items.length + 1)
    const taxRate = ((tr.querySelector('.r-rate') as HTMLSelectElement).value === '8' ? 8 : 10) as TaxRate
    items.push({
      name,
      quantity: Number.isNaN(quantity) ? 0 : quantity,
      unitPriceYen: Number.isNaN(unitPriceYen) ? 0 : unitPriceYen,
      taxRate,
    })
  })
  return {
    badNumberRows,
    issuer: {
      name: $<HTMLInputElement>('issuer-name').value.trim(),
      registrationNumber: normalizeRegistrationNumber($<HTMLInputElement>('issuer-reg').value),
      address: $<HTMLInputElement>('issuer-address').value.trim(),
      contact: $<HTMLInputElement>('issuer-contact').value.trim(),
      bankInfo: $<HTMLTextAreaElement>('issuer-bank').value.trim(),
    },
    invoice: {
      id: currentId,
      number: $<HTMLInputElement>('inv-number').value.trim(),
      issueDate: $<HTMLInputElement>('inv-issue').value,
      dueDate: $<HTMLInputElement>('inv-due').value,
      clientName: $<HTMLInputElement>('inv-client').value.trim(),
      items,
      rounding: $<HTMLSelectElement>('inv-rounding').value as Rounding,
      withholding: $<HTMLInputElement>('inv-withholding').checked,
      notes: $<HTMLTextAreaElement>('inv-notes').value.trim(),
    },
  }
}

function fillForm(inv: Invoice): void {
  currentId = inv.id
  $<HTMLInputElement>('inv-number').value = inv.number
  $<HTMLInputElement>('inv-issue').value = inv.issueDate
  $<HTMLInputElement>('inv-due').value = inv.dueDate
  $<HTMLInputElement>('inv-client').value = inv.clientName
  $<HTMLSelectElement>('inv-rounding').value = inv.rounding
  $<HTMLInputElement>('inv-withholding').checked = inv.withholding
  $<HTMLTextAreaElement>('inv-notes').value = inv.notes
  $('item-rows').innerHTML = ''
  if (inv.items.length === 0) addRow()
  inv.items.forEach((it) => addRow(it))
  refresh()
}

function fillIssuer(i: Issuer): void {
  $<HTMLInputElement>('issuer-name').value = i.name
  $<HTMLInputElement>('issuer-reg').value = i.registrationNumber
  $<HTMLInputElement>('issuer-address').value = i.address
  $<HTMLInputElement>('issuer-contact').value = i.contact
  $<HTMLTextAreaElement>('issuer-bank').value = i.bankInfo
}

function startNewInvoice(): void {
  currentId = newId()
  fillForm({
    id: currentId,
    number: nextInvoiceNumber(data.invoices.map((i) => i.number)),
    issueDate: today(),
    dueDate: '',
    clientName: '',
    items: [],
    rounding: 'floor',
    withholding: false,
    notes: '',
  })
  setStatus('')
  showErrors([])
}

// ---- 表示 ----
function setStatus(msg: string): void {
  $('status').textContent = msg
}

function showErrors(messages: string[]): void {
  const ul = $('errors')
  ul.innerHTML = ''
  for (const m of messages) {
    const li = document.createElement('li')
    li.textContent = m
    ul.appendChild(li)
  }
}

function el(tag: string, text?: string, cls?: string): HTMLElement {
  const e = document.createElement(tag)
  if (text !== undefined) e.textContent = text
  if (cls) e.className = cls
  return e
}

function row(cells: Array<[string, string?]>, head = false): HTMLTableRowElement {
  const tr = document.createElement('tr')
  for (const [text, cls] of cells) tr.appendChild(el(head ? 'th' : 'td', text, cls))
  return tr
}

function renderSheet(inv: Invoice, issuer: Issuer): void {
  const sheet = $('sheet')
  sheet.innerHTML = ''
  const t = computeTotals(inv.items, inv.rounding, inv.withholding)
  const hasReduced = inv.items.some((i) => i.taxRate === 8)

  sheet.appendChild(el('h3', '請求書'))
  const head = el('div', undefined, 'head')
  const left = el('div')
  left.appendChild(el('div', `${inv.clientName || '（請求先）'} 御中`, 'client'))
  left.appendChild(el('p', `請求書番号: ${inv.number}`))
  left.appendChild(el('p', `請求日: ${formatDate(inv.issueDate)}`))
  if (inv.dueDate) left.appendChild(el('p', `支払期限: ${formatDate(inv.dueDate)}`))
  const right = el('div', undefined, 'issuer')
  right.appendChild(el('strong', issuer.name || '（発行者名）'))
  right.appendChild(document.createTextNode('\n' + [issuer.address, issuer.contact].filter(Boolean).join('\n')))
  right.appendChild(document.createTextNode(`\n登録番号: ${issuer.registrationNumber || '（未入力）'}`))
  head.append(left, right)
  sheet.appendChild(head)

  sheet.appendChild(el('p', `ご請求金額: ${formatYen(t.totalYen)}`, 'total-line'))

  const table = document.createElement('table')
  table.appendChild(row([['品名'], ['数量'], ['単価'], ['税率'], ['金額(税抜)']], true))
  for (const it of inv.items) {
    const reduced = it.taxRate === 8
    table.appendChild(
      row([
        [(reduced ? '※ ' : '') + it.name],
        [String(it.quantity), 'num'],
        [formatYen(it.unitPriceYen), 'num'],
        [`${it.taxRate}%`, 'num'],
        [formatYen(lineAmountYen(it)), 'num'],
      ]),
    )
  }
  sheet.appendChild(table)
  if (hasReduced) sheet.appendChild(el('p', '※ は軽減税率（8%）対象品目です。', 'pre'))

  const sum = document.createElement('table')
  sum.appendChild(row([['税率区分'], ['税抜金額'], ['消費税額']], true))
  for (const r of t.byRate) {
    sum.appendChild(row([[`${r.rate}%対象`], [formatYen(r.subtotalYen), 'num'], [formatYen(r.taxYen), 'num']]))
  }
  sum.appendChild(row([['合計'], [formatYen(t.subtotalYen), 'num'], [formatYen(t.taxYen), 'num']]))
  if (inv.withholding) sum.appendChild(row([['源泉徴収税額'], [''], [`-${formatYen(t.withholdingYen)}`, 'num']]))
  sum.appendChild(row([['請求金額（税込）'], [''], [formatYen(t.totalYen), 'num']]))
  sheet.appendChild(sum)

  if (issuer.bankInfo) {
    sheet.appendChild(el('p', '【お振込先】', 'pre'))
    sheet.appendChild(el('p', issuer.bankInfo, 'pre'))
  }
  if (inv.notes) {
    sheet.appendChild(el('p', '【備考】', 'pre'))
    sheet.appendChild(el('p', inv.notes, 'pre'))
  }
}

function renderTotals(state: FormState): void {
  const rows = Array.from($('item-rows').children)
  const used = state.invoice.items
  let k = 0
  rows.forEach((tr) => {
    const name = (tr.querySelector('.r-name') as HTMLInputElement).value.trim()
    const price = (tr.querySelector('.r-price') as HTMLInputElement).value.trim()
    const cell = tr.querySelector('.r-amount') as HTMLElement
    cell.textContent = !name && !price ? '¥0' : formatYen(lineAmountYen(used[k++]))
  })
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.innerHTML = ''
  $('saved-empty').hidden = data.invoices.length > 0
  const sorted = [...data.invoices].sort((a, b) => b.number.localeCompare(a.number))
  for (const inv of sorted) {
    const li = document.createElement('li')
    const t = computeTotals(inv.items, inv.rounding, inv.withholding)
    li.appendChild(el('span', `${inv.number}　${inv.clientName || '（請求先未設定）'}　${formatYen(t.totalYen)}`, 'meta'))
    const open = el('button', '開く') as HTMLButtonElement
    open.type = 'button'
    open.addEventListener('click', () => {
      fillForm(inv)
      setStatus(`請求書 ${inv.number} を開きました。`)
      showErrors([])
    })
    const del = el('button', '削除', 'danger') as HTMLButtonElement
    del.type = 'button'
    del.addEventListener('click', () => {
      if (!confirm(`請求書 ${inv.number} を削除します。よろしいですか？`)) return
      data.invoices = data.invoices.filter((i) => i.id !== inv.id)
      saveData(data)
      renderSaved()
    })
    li.append(open, del)
    ul.appendChild(li)
  }
}

function refresh(): void {
  const state = readForm()
  renderSheet(state.invoice, state.issuer)
  renderTotals(state)
  // 発行者情報は入力のたびに自動保存する（請求書本体は「保存」ボタンで保存）
  data.issuer = state.issuer
  saveData(data)
}

function validateAll(strict: boolean): FormState | null {
  const state = readForm()
  const issues = strict
    ? validateInvoiceForIssue({
        issuerName: state.issuer.name,
        registrationNumber: state.issuer.registrationNumber,
        clientName: state.invoice.clientName,
        issueDate: state.invoice.issueDate,
        items: state.invoice.items,
      }).map((i) => i.message)
    : []
  if (!state.invoice.number) issues.push('請求書番号を入力してください。')
  for (const n of state.badNumberRows) issues.push(`明細${n}行目: 数量・単価は数値で入力してください。`)
  if (state.issuer.registrationNumber && !isValidRegistrationNumber(state.issuer.registrationNumber) && !strict) {
    issues.push('登録番号は「T」+数字13桁の形式で入力してください。')
  }
  showErrors(Array.from(new Set(issues)))
  return issues.length === 0 ? state : null
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

// ---- イベント ----
app.addEventListener('input', refresh)
app.addEventListener('change', refresh)
$('add-row').addEventListener('click', () => {
  addRow()
  refresh()
})
$('new-invoice').addEventListener('click', startNewInvoice)

$('save').addEventListener('click', () => {
  const state = validateAll(false)
  if (!state) return
  const idx = data.invoices.findIndex((i) => i.id === state.invoice.id)
  if (idx >= 0) data.invoices[idx] = state.invoice
  else data.invoices.push(state.invoice)
  data.issuer = state.issuer
  saveData(data)
  renderSaved()
  setStatus(`請求書 ${state.invoice.number} を保存しました。`)
})

$('print').addEventListener('click', () => {
  const state = validateAll(true)
  if (!state) return
  renderSheet(state.invoice, state.issuer)
  document.title = safeFileName(state.invoice.number, 'pdf').replace(/\.pdf$/, '')
  window.print()
  document.title = 'インボイス請求書ジェネレーター'
})

$('export-csv').addEventListener('click', () => {
  const state = validateAll(true)
  if (!state) return
  download(buildInvoiceCsvBlob(state.invoice), safeFileName(state.invoice.number, 'csv'))
  setStatus('CSVをダウンロードしました（Excelで開いても文字化けしないBOM付きUTF-8）。')
})

$('export-json').addEventListener('click', () => {
  refresh()
  download(dataToJsonBlob(data), `invoice-generator-backup-${today()}.json`)
  setStatus('全データをJSONで書き出しました。')
})

$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported = parseDataFromJsonText(await file.text())
    data = imported
    saveData(data)
    fillIssuer(data.issuer)
    renderSaved()
    startNewInvoice()
    showErrors([])
    setStatus(`${imported.invoices.length}件の請求書を読み込みました。`)
  } catch (err) {
    showErrors([err instanceof Error ? err.message : '読み込みに失敗しました。'])
  } finally {
    input.value = ''
  }
})

// ---- 初期化 ----
fillIssuer(data.issuer)
renderSaved()
startNewInvoice()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 非対応環境では通常のサイトとして動作する
    })
  })
}
