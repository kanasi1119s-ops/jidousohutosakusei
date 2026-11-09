import './style.css'
import {
  calculate, parseNumber, normalizeRegistrationNumber, validateInvoice,
  type Invoice, type Issuer, type Item, type PriceMode, type Rate, type Rounding,
} from './invoice'
import { loadInvoices, saveInvoices, loadIssuer, saveIssuer, mergeInvoices, backupToBlob, parseBackupText } from './storage'
import { buildInvoicesCsvBlob, csvDownloadFileName, jsonDownloadFileName } from './csv'
import { renderInvoiceHtml } from './preview'
import { escapeHtml as e, yen, jpDate } from './format'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

interface DraftItem { name: string; quantity: string; unit: string; unitPrice: string; rate: Rate }

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let invoices: Invoice[] = loadInvoices()
let currentId = ''
let draftItems: DraftItem[] = [{ name: '', quantity: '1', unit: '式', unitPrice: '', rate: 10 }]

function suggestNumber(): string {
  const ym = today().slice(0, 7).replace('-', '')
  let n = invoices.filter((i) => i.number.startsWith(`INV-${ym}-`)).length + 1
  while (invoices.some((i) => i.number === `INV-${ym}-${String(n).padStart(3, '0')}`)) n++
  return `INV-${ym}-${String(n).padStart(3, '0')}`
}

function newId(): string {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

app.innerHTML = `
  <h1>インボイス対応 請求書ジェネレーター</h1>
  <p class="subtitle">登録番号・税率ごとの消費税額を自動計算し、適格請求書の記載事項をチェックします。</p>
  <div>
    <span class="badge">登録不要</span>
    <span class="badge">入力データは外部送信されません</span>
    <span class="badge">オフラインでも利用可能</span>
  </div>
  <div class="layout">
    <div class="no-print">
      <section class="card">
        <h2>発行者（あなた）</h2>
        <div class="field"><label for="issuer-name">氏名又は名称</label><input id="issuer-name" autocomplete="off" /></div>
        <div class="field"><label for="issuer-reg">登録番号（T+数字13桁。免税事業者は空欄）</label><input id="issuer-reg" placeholder="T1234567890123" autocomplete="off" /></div>
        <div class="field"><label for="issuer-address">住所</label><input id="issuer-address" autocomplete="off" /></div>
        <div class="field"><label for="issuer-contact">連絡先（電話・メール）</label><input id="issuer-contact" autocomplete="off" /></div>
        <div class="field"><label for="issuer-bank">振込先</label><textarea id="issuer-bank"></textarea></div>
      </section>
      <section class="card">
        <h2>請求内容</h2>
        <div class="row2">
          <div class="field"><label for="inv-number">請求書番号</label><input id="inv-number" autocomplete="off" /></div>
          <div class="field"><label for="customer">宛名（取引先名）</label><input id="customer" autocomplete="off" /></div>
        </div>
        <div class="row2">
          <div class="field"><label for="issue-date">発行日（取引年月日）</label><input type="date" id="issue-date" /></div>
          <div class="field"><label for="due-date">支払期限（任意）</label><input type="date" id="due-date" /></div>
        </div>
        <div class="row2">
          <div class="field"><label for="price-mode">単価の入力方法</label>
            <select id="price-mode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select></div>
          <div class="field"><label for="rounding">消費税の端数処理</label>
            <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
        </div>
        <div class="items-wrap">
          <table class="items">
            <thead><tr><th>品名</th><th>数量</th><th>単位</th><th>単価</th><th>税率</th><th></th></tr></thead>
            <tbody id="items-body"></tbody>
          </table>
        </div>
        <div class="actions"><button type="button" class="secondary small" id="add-item">＋ 明細を追加</button></div>
        <div class="field"><label for="note">備考</label><textarea id="note"></textarea></div>
      </section>
    </div>
    <div class="preview-col">
      <section class="card">
        <h2>プレビュー</h2>
        <div class="messages" id="messages" role="status"></div>
        <div class="invoice-paper" id="preview"></div>
        <div class="actions no-print">
          <button type="button" id="save-invoice">保存</button>
          <button type="button" class="secondary" id="print-invoice">印刷 / PDF保存</button>
          <button type="button" class="secondary" id="new-invoice">新規作成</button>
        </div>
        <div class="status" id="status" role="status"></div>
      </section>
    </div>
  </div>
  <section class="card no-print">
    <h2>保存済みの請求書</h2>
    <div class="actions">
      <button type="button" class="secondary" id="export-json">バックアップ(JSON)</button>
      <button type="button" class="secondary" id="import-json">バックアップを読み込む</button>
      <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">一覧をCSVでダウンロード</button>
    </div>
    <div class="items-wrap"><table class="saved-table"><thead><tr><th>番号</th><th>発行日</th><th>宛名</th><th>税込合計</th><th></th></tr></thead><tbody id="saved-body"></tbody></table></div>
    <p class="status" id="saved-empty">まだ保存された請求書はありません。</p>
  </section>
  <div class="disclaimer no-print">
    <strong>免責事項:</strong>
    本ツールは請求書作成を補助するものであり、税務・法律上の助言ではありません。適格請求書の記載事項（国税庁公表）に沿ったチェックを行いますが、
    記載内容・端数処理・保存方法（電子帳簿保存法等）の最終確認はご自身または税理士等の専門家が行ってください。
    データはこの端末のブラウザ内にのみ保存されます。ブラウザのデータ削除や端末変更で失われるため、定期的に「バックアップ(JSON)」をご利用ください。
  </div>
  <footer class="no-print">制度の参照: 国税庁「適格請求書等保存方式（インボイス制度）」。確認基準日: 2026年11月</footer>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const issuerFields = { name: $<HTMLInputElement>('issuer-name'), reg: $<HTMLInputElement>('issuer-reg'), address: $<HTMLInputElement>('issuer-address'), contact: $<HTMLInputElement>('issuer-contact'), bank: $<HTMLTextAreaElement>('issuer-bank') }
const f = {
  number: $<HTMLInputElement>('inv-number'), customer: $<HTMLInputElement>('customer'), issue: $<HTMLInputElement>('issue-date'),
  due: $<HTMLInputElement>('due-date'), mode: $<HTMLSelectElement>('price-mode'), rounding: $<HTMLSelectElement>('rounding'), note: $<HTMLTextAreaElement>('note'),
}
const itemsBody = $<HTMLTableSectionElement>('items-body')
const statusEl = $('status')

function setStatus(msg: string): void { statusEl.textContent = msg }

function readIssuer(): Issuer {
  return {
    name: issuerFields.name.value.trim(), registrationNumber: normalizeRegistrationNumber(issuerFields.reg.value),
    address: issuerFields.address.value.trim(), contact: issuerFields.contact.value.trim(), bank: issuerFields.bank.value.trim(),
  }
}

function toItems(): Item[] {
  return draftItems.map((d) => ({
    name: d.name.trim(), quantity: parseNumber(d.quantity), unit: d.unit.trim(), unitPrice: parseNumber(d.unitPrice), rate: d.rate,
  }))
}

function buildInvoice(): Invoice {
  return {
    id: currentId || 'draft', number: f.number.value.trim(), issueDate: f.issue.value, dueDate: f.due.value, issuer: readIssuer(),
    customerName: f.customer.value.trim(), items: toItems(), priceMode: f.mode.value as PriceMode, rounding: f.rounding.value as Rounding,
    note: f.note.value.trim(), savedAt: new Date().toISOString(),
  }
}

function renderItems(): void {
  itemsBody.innerHTML = draftItems
    .map((d, i) => `<tr data-i="${i}">
      <td><input data-k="name" value="${e(d.name)}" aria-label="品名${i + 1}" autocomplete="off" /></td>
      <td class="num"><input data-k="quantity" value="${e(d.quantity)}" inputmode="decimal" aria-label="数量${i + 1}" /></td>
      <td class="unit"><input data-k="unit" value="${e(d.unit)}" aria-label="単位${i + 1}" /></td>
      <td class="price"><input data-k="unitPrice" value="${e(d.unitPrice)}" inputmode="decimal" aria-label="単価${i + 1}" /></td>
      <td class="rate"><select data-k="rate" aria-label="税率${i + 1}"><option value="10"${d.rate === 10 ? ' selected' : ''}>10%</option><option value="8"${d.rate === 8 ? ' selected' : ''}>8%軽減</option></select></td>
      <td><button type="button" class="danger small" data-remove="${i}" aria-label="明細${i + 1}を削除">削除</button></td>
    </tr>`)
    .join('')
}

function updatePreview(): void {
  const inv = buildInvoice()
  const v = validateInvoice(inv)
  const list = (cls: string, arr: string[]) => (arr.length ? `<div class="${cls}"><ul>${arr.map((m) => `<li>${e(m)}</li>`).join('')}</ul></div>` : '')
  $('messages').innerHTML = list('err', v.errors) + list('warn', v.warnings)
  const safe: Invoice = { ...inv, items: inv.items.map((it) => ({ ...it, quantity: Number.isFinite(it.quantity) ? it.quantity : 0, unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0 })) }
  $('preview').innerHTML = renderInvoiceHtml(safe)
}

function renderSaved(): void {
  const sorted = [...invoices].sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0))
  $('saved-body').innerHTML = sorted
    .map((inv) => {
      const c = calculate(inv.items, inv.priceMode, inv.rounding)
      return `<tr><td>${e(inv.number)}</td><td>${e(jpDate(inv.issueDate))}</td><td>${e(inv.customerName)}</td><td class="r">${yen(c.gross)}</td>
        <td><button type="button" class="secondary small" data-load="${e(inv.id)}">開く</button>
        <button type="button" class="danger small" data-delete="${e(inv.id)}">削除</button></td></tr>`
    })
    .join('')
  $('saved-empty').classList.toggle('hidden', invoices.length > 0)
}

function fillForm(inv: Invoice | null): void {
  const issuer = inv ? inv.issuer : loadIssuer()
  issuerFields.name.value = issuer.name
  issuerFields.reg.value = issuer.registrationNumber
  issuerFields.address.value = issuer.address
  issuerFields.contact.value = issuer.contact
  issuerFields.bank.value = issuer.bank
  currentId = inv ? inv.id : ''
  f.number.value = inv ? inv.number : suggestNumber()
  f.customer.value = inv ? inv.customerName : ''
  f.issue.value = inv ? inv.issueDate : today()
  f.due.value = inv ? inv.dueDate : ''
  f.mode.value = inv ? inv.priceMode : 'exclusive'
  f.rounding.value = inv ? inv.rounding : 'floor'
  f.note.value = inv ? inv.note : ''
  draftItems = inv
    ? inv.items.map((it) => ({ name: it.name, quantity: String(it.quantity), unit: it.unit, unitPrice: String(it.unitPrice), rate: it.rate }))
    : [{ name: '', quantity: '1', unit: '式', unitPrice: '', rate: 10 }]
  renderItems()
  updatePreview()
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

// --- events ---
document.querySelector('.no-print')!.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement
  const tr = t.closest('tr[data-i]') as HTMLElement | null
  if (tr && t.dataset.k) {
    const d = draftItems[Number(tr.dataset.i)] as unknown as Record<string, unknown>
    d[t.dataset.k] = t.dataset.k === 'rate' ? (t.value === '8' ? 8 : 10) : t.value
  }
  updatePreview()
})

itemsBody.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('[data-remove]') as HTMLElement | null
  if (!btn) return
  draftItems.splice(Number(btn.dataset.remove), 1)
  renderItems()
  updatePreview()
})

$('add-item').addEventListener('click', () => {
  draftItems.push({ name: '', quantity: '1', unit: '式', unitPrice: '', rate: 10 })
  renderItems()
  updatePreview()
})

$('save-invoice').addEventListener('click', () => {
  const inv = buildInvoice()
  const v = validateInvoice(inv)
  if (v.errors.length > 0) { setStatus('入力内容を確認してください（プレビュー上部のエラー）。保存していません。'); return }
  if (!currentId) currentId = newId()
  inv.id = currentId
  invoices = mergeInvoices(invoices, [inv])
  const ok = saveInvoices(invoices) && saveIssuer(inv.issuer)
  renderSaved()
  setStatus(ok ? `保存しました（${inv.number}）。` : 'ブラウザの保存領域に書き込めませんでした。バックアップ(JSON)をダウンロードしてください。')
})

$('new-invoice').addEventListener('click', () => { fillForm(null); setStatus('新しい請求書を作成します。') })
$('print-invoice').addEventListener('click', () => window.print())

$('saved-body').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement
  const load = t.closest('[data-load]') as HTMLElement | null
  const del = t.closest('[data-delete]') as HTMLElement | null
  if (load) {
    const inv = invoices.find((i) => i.id === load.dataset.load)
    if (inv) { fillForm(inv); setStatus(`${inv.number} を開きました。`) }
  } else if (del) {
    const inv = invoices.find((i) => i.id === del.dataset.delete)
    if (inv && window.confirm(`${inv.number} を削除しますか？（元に戻せません）`)) {
      invoices = invoices.filter((i) => i.id !== inv.id)
      saveInvoices(invoices)
      if (currentId === inv.id) currentId = ''
      renderSaved()
      setStatus('削除しました。')
    }
  }
})

$('export-json').addEventListener('click', () => download(backupToBlob(invoices, readIssuer()), jsonDownloadFileName()))
$('export-csv').addEventListener('click', () => download(buildInvoicesCsvBlob(invoices), csvDownloadFileName()))
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$<HTMLInputElement>('import-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const parsed = parseBackupText(await file.text())
    invoices = mergeInvoices(invoices, parsed.invoices)
    saveInvoices(invoices)
    if (parsed.issuer && !loadIssuer().name) saveIssuer(parsed.issuer)
    renderSaved()
    setStatus(`${parsed.invoices.length}件を読み込みました` + (parsed.skipped ? `（形式不正の${parsed.skipped}件はスキップ）。` : '。'))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : '読み込みに失敗しました。')
  } finally {
    input.value = ''
  }
})

fillForm(null)
renderSaved()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined) })
}
