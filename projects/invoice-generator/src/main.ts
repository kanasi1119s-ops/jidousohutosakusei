import './style.css'
import { calcTotals, formatYen, lineAmountYen, normalizeRegistrationNumber, parseNumberInput, type InvoiceItem, type Rounding, type TaxRate } from './calc'
import { checkInvoice, emptyInvoice, parseAppData, type AppData, type Invoice } from './model'
import { dataToJsonBlob, loadData, saveData } from './storage'
import { buildInvoiceCsvBlob, safeFileName } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

let data: AppData = loadData()
let inv: Invoice = emptyInvoice(today())
// 画面上の明細入力は文字列で保持し、プレビュー時に正規化して数値化する
let rawItems: { description: string; quantity: string; unitPrice: string; taxRate: TaxRate }[] = [{ description: '', quantity: '1', unitPrice: '0', taxRate: 10 }]

app.innerHTML = `
  <h1>インボイス請求書ジェネレーター</h1>
  <p class="subtitle">適格請求書（インボイス）の記載事項に沿った請求書を作成し、印刷／PDF保存できます。</p>
  <div>
    <span class="badge">登録不要</span><span class="badge">入力データは外部送信されません</span><span class="badge">オフラインでも利用可能</span>
  </div>
  <section class="panel" aria-labelledby="h-issuer">
    <h2 id="h-issuer">発行者（あなた）の情報</h2>
    <div class="grid">
      <div class="field"><label for="issuerName">氏名または名称</label><input id="issuerName" autocomplete="off" /></div>
      <div class="field"><label for="issuerReg">登録番号（T＋数字13桁）</label><input id="issuerReg" placeholder="T1234567890123" autocomplete="off" /></div>
      <div class="field"><label for="issuerAddress">住所</label><input id="issuerAddress" autocomplete="off" /></div>
      <div class="field"><label for="issuerContact">連絡先（電話・メール）</label><input id="issuerContact" autocomplete="off" /></div>
    </div>
    <div class="field" style="margin-top:10px"><label for="issuerBank">振込先</label><textarea id="issuerBank"></textarea></div>
  </section>
  <section class="panel" aria-labelledby="h-inv">
    <h2 id="h-inv">請求書の内容</h2>
    <div class="grid">
      <div class="field"><label for="invNumber">請求書番号</label><input id="invNumber" placeholder="2026-001" autocomplete="off" /></div>
      <div class="field"><label for="invDate">発行日</label><input id="invDate" type="date" /></div>
      <div class="field"><label for="invDue">支払期限</label><input id="invDue" type="date" /></div>
      <div class="field"><label for="invClient">請求先（宛名）</label><input id="invClient" autocomplete="off" /></div>
      <div class="field"><label for="invSubject">件名</label><input id="invSubject" autocomplete="off" /></div>
      <div class="field"><label for="invRounding">消費税の端数処理</label>
        <select id="invRounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
    </div>
    <h2 style="margin-top:14px">明細（金額は税抜で入力）</h2>
    <table class="items">
      <thead><tr><th>品名・内容</th><th>数量</th><th>単価（円・税抜）</th><th>税率</th><th>金額</th><th></th></tr></thead>
      <tbody id="items-body"></tbody>
    </table>
    <div class="actions"><button type="button" class="secondary" id="add-item">明細を追加</button></div>
    <div class="field" style="margin-top:10px"><label for="invNote">備考</label><textarea id="invNote"></textarea></div>
    <div class="errors" id="errors" role="alert"></div>
  </section>
  <section class="panel" id="preview-wrap" aria-labelledby="h-prev">
    <h2 id="h-prev">プレビュー</h2>
    <div class="paper" id="paper"></div>
    <div class="actions">
      <button type="button" id="print">印刷／PDFとして保存</button>
      <button type="button" class="secondary" id="save-inv">この請求書を保存</button>
      <button type="button" class="secondary" id="new-inv">新しい請求書</button>
      <button type="button" class="secondary" id="export-csv">明細をCSVでダウンロード</button>
    </div>
    <p class="notice">「印刷／PDFとして保存」を押し、送信先で「PDFに保存」を選ぶとPDFを作成できます。</p>
  </section>
  <section class="panel saved" aria-labelledby="h-saved">
    <h2 id="h-saved">保存済みの請求書</h2>
    <ul id="saved-list"></ul>
    <div class="actions">
      <button type="button" class="secondary" id="export-json">全データをバックアップ(JSON)</button>
      <button type="button" class="secondary" id="import-json">バックアップを読み込む</button>
      <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
    </div>
    <p class="notice">データはこのブラウザ内（localStorage）にのみ保存されます。ブラウザのデータ削除で消えるため、定期的にバックアップしてください。</p>
    <div class="errors" id="io-msg" role="status"></div>
  </section>
  <footer class="notice">
    <p>本ツールは請求書作成の補助です。税務上の取扱い（登録の要否・税率区分・端数処理の適否等）は国税庁の公表資料または税理士にご確認ください。計算結果・出力物について作成者は責任を負いません。</p>
    <p>参考: 国税庁「適格請求書等保存方式（インボイス制度）の概要」（基準日: 2026年11月）</p>
  </footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const issuerFields = { name: $<HTMLInputElement>('issuerName'), reg: $<HTMLInputElement>('issuerReg'), address: $<HTMLInputElement>('issuerAddress'), contact: $<HTMLInputElement>('issuerContact'), bank: $<HTMLTextAreaElement>('issuerBank') }

function itemsFromRaw(): InvoiceItem[] {
  return rawItems.map((r) => ({ description: r.description, quantity: parseNumberInput(r.quantity), unitPriceYen: parseNumberInput(r.unitPrice), taxRate: r.taxRate }))
}

function readForm(): void {
  data.issuer = { name: issuerFields.name.value, registrationNumber: normalizeRegistrationNumber(issuerFields.reg.value), address: issuerFields.address.value, contact: issuerFields.contact.value, bank: issuerFields.bank.value }
  inv.number = $<HTMLInputElement>('invNumber').value
  inv.issueDate = $<HTMLInputElement>('invDate').value
  inv.dueDate = $<HTMLInputElement>('invDue').value
  inv.clientName = $<HTMLInputElement>('invClient').value
  inv.subject = $<HTMLInputElement>('invSubject').value
  inv.rounding = $<HTMLSelectElement>('invRounding').value as Rounding
  inv.note = $<HTMLTextAreaElement>('invNote').value
  inv.items = itemsFromRaw()
}

function writeForm(): void {
  issuerFields.name.value = data.issuer.name
  issuerFields.reg.value = data.issuer.registrationNumber
  issuerFields.address.value = data.issuer.address
  issuerFields.contact.value = data.issuer.contact
  issuerFields.bank.value = data.issuer.bank
  $<HTMLInputElement>('invNumber').value = inv.number
  $<HTMLInputElement>('invDate').value = inv.issueDate
  $<HTMLInputElement>('invDue').value = inv.dueDate
  $<HTMLInputElement>('invClient').value = inv.clientName
  $<HTMLInputElement>('invSubject').value = inv.subject
  $<HTMLSelectElement>('invRounding').value = inv.rounding
  $<HTMLTextAreaElement>('invNote').value = inv.note
  rawItems = inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPriceYen), taxRate: i.taxRate }))
  renderItems()
}

function renderItems(): void {
  const body = $('items-body')
  body.innerHTML = ''
  rawItems.forEach((r, i) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><input data-k="description" data-i="${i}" aria-label="品名・内容 ${i + 1}" value="${esc(r.description)}" /></td>
      <td><input class="num" data-k="quantity" data-i="${i}" aria-label="数量 ${i + 1}" inputmode="decimal" value="${esc(r.quantity)}" /></td>
      <td><input class="num" data-k="unitPrice" data-i="${i}" aria-label="単価 ${i + 1}" inputmode="decimal" value="${esc(r.unitPrice)}" /></td>
      <td><select data-k="taxRate" data-i="${i}" aria-label="税率 ${i + 1}">
        <option value="10"${r.taxRate === 10 ? ' selected' : ''}>10%</option>
        <option value="8"${r.taxRate === 8 ? ' selected' : ''}>8%（軽減）</option>
        <option value="0"${r.taxRate === 0 ? ' selected' : ''}>0%（不課税等）</option></select></td>
      <td class="amount" data-amount="${i}"></td>
      <td><button type="button" class="danger" data-del="${i}" aria-label="明細${i + 1}を削除">削除</button></td>`
    body.appendChild(tr)
  })
}

function renderPreview(): void {
  readForm()
  const t = calcTotals(inv.items.filter((i) => Number.isFinite(i.quantity) && Number.isFinite(i.unitPriceYen)), inv.rounding)
  document.querySelectorAll<HTMLElement>('[data-amount]').forEach((el) => {
    const it = inv.items[Number(el.dataset.amount)]
    el.textContent = it && Number.isFinite(it.quantity) && Number.isFinite(it.unitPriceYen) ? formatYen(Math.round(lineAmountYen(it))) : '-'
  })
  const rows = inv.items
    .map((it) => {
      const ok = Number.isFinite(it.quantity) && Number.isFinite(it.unitPriceYen)
      return `<tr><td>${esc(it.description)}${it.taxRate === 8 ? '（軽減税率対象）' : ''}</td><td class="r">${ok ? it.quantity : '-'}</td><td class="r">${ok ? formatYen(it.unitPriceYen) : '-'}</td><td class="r">${it.taxRate}%</td><td class="r">${ok ? formatYen(Math.round(lineAmountYen(it))) : '-'}</td></tr>`
    })
    .join('')
  const sums = t.byRate.map((r) => `<tr><td>${r.taxRate}%対象（税抜）</td><td class="r">${formatYen(r.subtotalYen)}</td><td>消費税額等（${r.taxRate}%）</td><td class="r">${formatYen(r.taxYen)}</td></tr>`).join('')
  $('paper').innerHTML = `
    <h2>請求書</h2>
    <div class="meta">
      <div><strong>${esc(inv.clientName) || '（請求先未入力）'} 御中</strong><div>件名: ${esc(inv.subject)}</div></div>
      <div>請求書番号: ${esc(inv.number)}<br/>発行日: ${esc(inv.issueDate)}<br/>支払期限: ${esc(inv.dueDate)}</div>
    </div>
    <div class="grand">ご請求金額（税込）: ${formatYen(t.totalYen)}</div>
    <table><thead><tr><th>品名・内容</th><th>数量</th><th>単価</th><th>税率</th><th>金額（税抜）</th></tr></thead><tbody>${rows}</tbody></table>
    <table><tbody>${sums}<tr><td colspan="2">税抜合計 ${formatYen(t.subtotalYen)}</td><td>消費税合計</td><td class="r">${formatYen(t.taxYen)}</td></tr></tbody></table>
    <div style="margin-top:12px">
      <div><strong>${esc(data.issuer.name)}</strong></div>
      <div>登録番号: ${esc(data.issuer.registrationNumber)}</div>
      <div>${esc(data.issuer.address)}</div><div>${esc(data.issuer.contact)}</div>
      ${data.issuer.bank ? `<div style="margin-top:8px">振込先:<pre>${esc(data.issuer.bank)}</pre></div>` : ''}
      ${inv.note ? `<div style="margin-top:8px">備考:<pre>${esc(inv.note)}</pre></div>` : ''}
    </div>`
  saveData({ ...data, invoices: data.invoices })
}

function showProblems(): boolean {
  const problems = checkInvoice(data.issuer, inv)
  $('errors').innerHTML = problems.map((p) => `<div>${esc(p.message)}</div>`).join('')
  return problems.length === 0
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.innerHTML = ''
  if (data.invoices.length === 0) {
    ul.innerHTML = '<li>保存済みの請求書はありません。</li>'
    return
  }
  data.invoices.forEach((v) => {
    const t = calcTotals(v.items, v.rounding)
    const li = document.createElement('li')
    li.innerHTML = `<span>${esc(v.number || '(番号なし)')} / ${esc(v.clientName)} / ${formatYen(t.totalYen)}</span>
      <span><button type="button" class="secondary" data-open="${esc(v.id)}">開く</button> <button type="button" class="danger" data-remove="${esc(v.id)}">削除</button></span>`
    ul.appendChild(li)
  })
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement
  if (el.dataset.k && el.dataset.i !== undefined) {
    const r = rawItems[Number(el.dataset.i)]
    if (el.dataset.k === 'taxRate') r.taxRate = Number(el.value) as TaxRate
    else (r as unknown as Record<string, string>)[el.dataset.k] = el.value
  }
  renderPreview()
})

app.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  if (t.dataset.del !== undefined) {
    rawItems.splice(Number(t.dataset.del), 1)
    renderItems()
    renderPreview()
  } else if (t.dataset.open) {
    const found = data.invoices.find((v) => v.id === t.dataset.open)
    if (found) { inv = structuredClone(found); writeForm(); renderPreview(); showProblems() }
  } else if (t.dataset.remove) {
    data.invoices = data.invoices.filter((v) => v.id !== t.dataset.remove)
    saveData(data)
    renderSaved()
  }
})

$('add-item').addEventListener('click', () => {
  rawItems.push({ description: '', quantity: '1', unitPrice: '0', taxRate: 10 })
  renderItems()
  renderPreview()
})
$('print').addEventListener('click', () => { renderPreview(); if (showProblems()) window.print() })
$('save-inv').addEventListener('click', () => {
  renderPreview()
  if (!showProblems()) return
  const i = data.invoices.findIndex((v) => v.id === inv.id)
  const copy = structuredClone(inv)
  if (i >= 0) data.invoices[i] = copy
  else data.invoices.push(copy)
  saveData(data)
  renderSaved()
  $('io-msg').textContent = '請求書を保存しました。'
})
$('new-inv').addEventListener('click', () => {
  inv = emptyInvoice(today())
  writeForm()
  renderPreview()
  $('errors').innerHTML = ''
})
$('export-csv').addEventListener('click', () => {
  renderPreview()
  if (showProblems()) download(buildInvoiceCsvBlob(inv), safeFileName('invoice', 'csv'))
})
$('export-json').addEventListener('click', () => {
  renderPreview()
  download(dataToJsonBlob(data), safeFileName('invoice-backup', 'json'))
})
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = new TextDecoder('utf-8').decode(await file.arrayBuffer())
    data = parseAppData(text)
    saveData(data)
    inv = data.invoices[0] ? structuredClone(data.invoices[0]) : emptyInvoice(today())
    writeForm()
    renderPreview()
    renderSaved()
    $('io-msg').textContent = `${data.invoices.length}件の請求書を読み込みました。`
  } catch (err) {
    $('io-msg').textContent = err instanceof Error ? err.message : '読み込みに失敗しました。'
  } finally {
    input.value = ''
  }
})

writeForm()
renderPreview()
renderSaved()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined)
}
