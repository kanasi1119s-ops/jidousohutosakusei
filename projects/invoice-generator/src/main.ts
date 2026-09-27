import './style.css'
import * as db from './db'
import {
  computeInvoiceTotals,
  validateInvoice,
  validateRegistrationNumber,
  type Client,
  type Invoice,
  type InvoiceItem,
  type TaxRate,
} from './invoice'
import { DEFAULT_NUMBERING, advanceNumbering, formatInvoiceNumber, validatePrefix, type NumberingState } from './numbering'
import { DEFAULT_PROFILE, appDataToJsonBlob, jsonDownloadFileName, parseAppDataFromJsonText, type Profile } from './storage'
import { buildInvoiceHistoryCsvBlob, csvDownloadFileName } from './csv'
import { printInvoice } from './print'
import { escapeHtml, formatYen, generateId } from './util'

type TabId = 'profile' | 'clients' | 'invoice' | 'history'

interface AppState {
  profile: Profile
  numbering: NumberingState
  clients: Client[]
  invoices: Invoice[]
  draftItems: InvoiceItem[]
  editingInvoiceId: string | null
}

const state: AppState = {
  profile: DEFAULT_PROFILE,
  numbering: DEFAULT_NUMBERING,
  clients: [],
  invoices: [],
  draftItems: [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
  editingInvoiceId: null,
}

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>適格請求書ジェネレーター</h1>
  <div class="badges">
    <span class="badge">登録不要</span>
    <span class="badge">入力データは外部送信されません</span>
    <span class="badge">オフラインでも利用可能</span>
  </div>
  <nav class="tabs" role="tablist">
    <button data-tab="profile" role="tab">事業者情報</button>
    <button data-tab="clients" role="tab">取引先</button>
    <button data-tab="invoice" role="tab">請求書作成</button>
    <button data-tab="history" role="tab">履歴・出力</button>
  </nav>

  <section class="panel" id="panel-profile">
    <h2>事業者情報</h2>
    <form id="profile-form" novalidate>
      <div class="field">
        <label for="businessName">事業者名（発行者）</label>
        <input id="businessName" name="businessName" type="text" required />
      </div>
      <div class="field">
        <label for="registrationNumber">適格請求書発行事業者登録番号（例: T1234567890123）</label>
        <input id="registrationNumber" name="registrationNumber" type="text" />
      </div>
      <div class="field">
        <label for="address">住所</label>
        <textarea id="address" name="address" rows="2"></textarea>
      </div>
      <div class="field">
        <label for="bankInfo">お支払先（銀行口座等）</label>
        <textarea id="bankInfo" name="bankInfo" rows="2"></textarea>
      </div>
      <div class="field">
        <label for="numberPrefix">請求書番号 接頭辞</label>
        <input id="numberPrefix" name="numberPrefix" type="text" />
      </div>
      <div class="field">
        <label for="nextNumber">次の請求書番号（連番）</label>
        <input id="nextNumber" name="nextNumber" type="number" min="1" step="1" />
      </div>
      <div class="errors" id="profile-errors" role="alert"></div>
      <div class="actions">
        <button type="submit">事業者情報を保存</button>
      </div>
    </form>
  </section>

  <section class="panel" id="panel-clients">
    <h2>取引先</h2>
    <form id="client-form" novalidate>
      <div class="field">
        <label for="clientName">取引先名</label>
        <input id="clientName" name="clientName" type="text" required />
      </div>
      <div class="field">
        <label for="clientAddress">住所</label>
        <textarea id="clientAddress" name="clientAddress" rows="2"></textarea>
      </div>
      <div class="errors" id="client-errors" role="alert"></div>
      <div class="actions">
        <button type="submit">取引先を追加</button>
      </div>
    </form>
    <table>
      <thead><tr><th>取引先名</th><th>住所</th><th></th></tr></thead>
      <tbody id="clients-body"></tbody>
    </table>
  </section>

  <section class="panel" id="panel-invoice">
    <h2>請求書作成</h2>
    <form id="invoice-form" novalidate>
      <div class="field">
        <label for="invoiceClientSelect">取引先（保存済みから選択、任意）</label>
        <select id="invoiceClientSelect"><option value="">-- 手入力 --</option></select>
      </div>
      <div class="field">
        <label for="invoiceClientName">取引先名</label>
        <input id="invoiceClientName" name="invoiceClientName" type="text" required />
      </div>
      <div class="field">
        <label for="invoiceClientAddress">取引先住所</label>
        <textarea id="invoiceClientAddress" name="invoiceClientAddress" rows="2"></textarea>
      </div>
      <div class="field">
        <label for="issueDate">発行日</label>
        <input id="issueDate" name="issueDate" type="date" required />
      </div>
      <div class="field">
        <label for="dueDate">お支払期限</label>
        <input id="dueDate" name="dueDate" type="date" />
      </div>

      <h3>品目</h3>
      <div id="item-rows"></div>
      <div class="actions">
        <button type="button" class="secondary" id="add-item-row">品目を追加</button>
      </div>

      <div class="field">
        <label for="notes">備考</label>
        <textarea id="notes" name="notes" rows="2"></textarea>
      </div>

      <div id="invoice-totals"></div>

      <div class="errors" id="invoice-errors" role="alert"></div>
      <div class="actions">
        <button type="submit">請求書を保存</button>
        <button type="button" class="secondary" id="reset-invoice-form">新規作成に戻す</button>
      </div>
    </form>
  </section>

  <section class="panel" id="panel-history">
    <h2>履歴・出力</h2>
    <div class="actions">
      <button type="button" class="secondary" id="export-csv">履歴をCSVでダウンロード</button>
      <button type="button" class="secondary" id="export-json">全データをJSONでバックアップ</button>
      <button type="button" class="secondary" id="import-json">JSONからインポート</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
    </div>
    <div class="errors" id="history-errors" role="alert"></div>
    <table>
      <thead><tr><th>番号</th><th>発行日</th><th>取引先</th><th class="num">合計（税込）</th><th></th></tr></thead>
      <tbody id="invoices-body"></tbody>
    </table>
  </section>

  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは適格請求書（インボイス）の記載要件を参考にした簡易な請求書作成支援であり、
    税務・法律上の助言に代わるものではありません。記載内容・登録番号・消費税額の計算方法が
    実際の取引・制度に適合しているかは、国税庁の公表情報または税理士等の専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内（IndexedDB）にのみ保存されます（サーバーへの送信は行いません）。</footer>
`

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('nav.tabs button'))
const panels: Record<TabId, HTMLElement> = {
  profile: document.getElementById('panel-profile')!,
  clients: document.getElementById('panel-clients')!,
  invoice: document.getElementById('panel-invoice')!,
  history: document.getElementById('panel-history')!,
}

function showTab(tab: TabId): void {
  for (const btn of tabButtons) {
    btn.setAttribute('aria-current', String(btn.dataset.tab === tab))
  }
  for (const [id, el] of Object.entries(panels)) {
    el.classList.toggle('active', id === tab)
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab as TabId))
})

// --- 事業者情報 ---
const profileForm = document.getElementById('profile-form') as HTMLFormElement
const profileErrors = document.getElementById('profile-errors') as HTMLDivElement

function fillProfileForm(): void {
  ;(profileForm.elements.namedItem('businessName') as HTMLInputElement).value = state.profile.businessName
  ;(profileForm.elements.namedItem('registrationNumber') as HTMLInputElement).value = state.profile.registrationNumber
  ;(profileForm.elements.namedItem('address') as HTMLTextAreaElement).value = state.profile.address
  ;(profileForm.elements.namedItem('bankInfo') as HTMLTextAreaElement).value = state.profile.bankInfo
  ;(profileForm.elements.namedItem('numberPrefix') as HTMLInputElement).value = state.numbering.prefix
  ;(profileForm.elements.namedItem('nextNumber') as HTMLInputElement).value = String(state.numbering.nextNumber)
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = new FormData(profileForm)
  const profile: Profile = {
    businessName: String(data.get('businessName') ?? ''),
    registrationNumber: String(data.get('registrationNumber') ?? ''),
    address: String(data.get('address') ?? ''),
    bankInfo: String(data.get('bankInfo') ?? ''),
  }
  const prefix = String(data.get('numberPrefix') ?? '')
  const nextNumber = Number(data.get('nextNumber') ?? 1)
  const errors = [...validatePrefix(prefix), ...validateRegistrationNumber(profile.registrationNumber)]
  if (!Number.isFinite(nextNumber) || nextNumber < 1) errors.push('次の請求書番号は1以上の整数で入力してください。')

  profileErrors.textContent = errors.join(' ')
  if (errors.length > 0) return

  state.profile = profile
  state.numbering = { prefix, nextNumber: Math.trunc(nextNumber) }
  await db.saveMeta({ profile: state.profile, numbering: state.numbering })
  profileErrors.textContent = '保存しました。'
  renderInvoiceClientSelect()
})

// --- 取引先 ---
const clientForm = document.getElementById('client-form') as HTMLFormElement
const clientErrors = document.getElementById('client-errors') as HTMLDivElement
const clientsBody = document.getElementById('clients-body') as HTMLTableSectionElement

function renderClients(): void {
  clientsBody.innerHTML = state.clients
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.address)}</td>
        <td><button type="button" class="danger" data-delete-client="${c.id}">削除</button></td>
      </tr>`,
    )
    .join('')
  renderInvoiceClientSelect()
}

clientsBody.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement
  const id = target.dataset.deleteClient
  if (!id) return
  await db.deleteClient(id)
  state.clients = state.clients.filter((c) => c.id !== id)
  renderClients()
})

clientForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = new FormData(clientForm)
  const name = String(data.get('clientName') ?? '').trim()
  const address = String(data.get('clientAddress') ?? '').trim()
  if (!name) {
    clientErrors.textContent = '取引先名を入力してください。'
    return
  }
  clientErrors.textContent = ''
  const client: Client = { id: generateId(), name, address }
  await db.saveClient(client)
  state.clients.push(client)
  clientForm.reset()
  renderClients()
})

// --- 請求書作成 ---
const invoiceForm = document.getElementById('invoice-form') as HTMLFormElement
const invoiceErrors = document.getElementById('invoice-errors') as HTMLDivElement
const itemRowsEl = document.getElementById('item-rows') as HTMLDivElement
const totalsEl = document.getElementById('invoice-totals') as HTMLDivElement
const clientSelect = document.getElementById('invoiceClientSelect') as HTMLSelectElement

function renderInvoiceClientSelect(): void {
  const current = clientSelect.value
  clientSelect.innerHTML =
    '<option value="">-- 手入力 --</option>' +
    state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
  clientSelect.value = current
}

clientSelect.addEventListener('change', () => {
  const client = state.clients.find((c) => c.id === clientSelect.value)
  if (client) {
    ;(invoiceForm.elements.namedItem('invoiceClientName') as HTMLInputElement).value = client.name
    ;(invoiceForm.elements.namedItem('invoiceClientAddress') as HTMLTextAreaElement).value = client.address
  }
})

function renderItemRows(): void {
  itemRowsEl.innerHTML = state.draftItems
    .map(
      (item, i) => `
      <div class="item-row" data-index="${i}">
        <input type="text" placeholder="品目名" value="${escapeHtml(item.name)}" data-field="name" data-index="${i}" />
        <input type="number" min="0" step="0.01" placeholder="数量" value="${item.quantity}" data-field="quantity" data-index="${i}" />
        <input type="number" min="0" step="1" placeholder="単価（円）" value="${item.unitPriceYen}" data-field="unitPriceYen" data-index="${i}" />
        <select data-field="taxRate" data-index="${i}">
          <option value="10" ${item.taxRate === 10 ? 'selected' : ''}>10%</option>
          <option value="8" ${item.taxRate === 8 ? 'selected' : ''}>8%（軽減）</option>
          <option value="0" ${item.taxRate === 0 ? 'selected' : ''}>対象外</option>
        </select>
        <button type="button" class="danger" data-remove-row="${i}" ${state.draftItems.length <= 1 ? 'disabled' : ''}>削除</button>
      </div>`,
    )
    .join('')
  renderTotals()
}

function renderTotals(): void {
  const totals = computeInvoiceTotals(state.draftItems)
  totalsEl.innerHTML = `
    <table>
      <thead><tr><th>税率区分</th><th class="num">対象金額（税抜）</th><th class="num">消費税額</th></tr></thead>
      <tbody>
        ${totals.rateGroups
          .map(
            (g) =>
              `<tr><td>${g.taxRate === 0 ? '対象外・非課税' : g.taxRate + '%対象'}</td><td class="num">${formatYen(g.subtotalYen)}</td><td class="num">${formatYen(g.taxYen)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <p><strong>合計（税込）: ${formatYen(totals.grandTotalYen)}</strong></p>
    <p>次の請求書番号: ${escapeHtml(formatInvoiceNumber(state.numbering))}</p>
  `
}

itemRowsEl.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement | HTMLSelectElement
  const index = Number(target.dataset.index)
  const field = target.dataset.field
  if (Number.isNaN(index) || !field) return
  const item = state.draftItems[index]
  if (!item) return
  if (field === 'name') item.name = target.value
  else if (field === 'quantity') item.quantity = Number(target.value)
  else if (field === 'unitPriceYen') item.unitPriceYen = Number(target.value)
  else if (field === 'taxRate') item.taxRate = Number(target.value) as TaxRate
  renderTotals()
})

itemRowsEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const idx = target.dataset.removeRow
  if (idx === undefined) return
  state.draftItems.splice(Number(idx), 1)
  renderItemRows()
})

document.getElementById('add-item-row')!.addEventListener('click', () => {
  state.draftItems.push({ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
  renderItemRows()
})

document.getElementById('reset-invoice-form')!.addEventListener('click', () => {
  resetInvoiceForm()
})

function resetInvoiceForm(): void {
  state.editingInvoiceId = null
  state.draftItems = [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }]
  invoiceForm.reset()
  ;(invoiceForm.elements.namedItem('issueDate') as HTMLInputElement).value = new Date().toISOString().slice(0, 10)
  invoiceErrors.textContent = ''
  renderItemRows()
}

invoiceForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = new FormData(invoiceForm)
  const clientName = String(data.get('invoiceClientName') ?? '').trim()
  const clientAddress = String(data.get('invoiceClientAddress') ?? '').trim()
  const issueDate = String(data.get('issueDate') ?? '')
  const dueDate = String(data.get('dueDate') ?? '')
  const notes = String(data.get('notes') ?? '').trim()

  const errors = validateInvoice({ clientName, issueDate, items: state.draftItems })
  invoiceErrors.textContent = errors.join('\n')
  if (errors.length > 0) return

  const isEditing = state.editingInvoiceId !== null
  const invoice: Invoice = {
    id: state.editingInvoiceId ?? generateId(),
    number: isEditing
      ? state.invoices.find((inv) => inv.id === state.editingInvoiceId)!.number
      : formatInvoiceNumber(state.numbering),
    issueDate,
    dueDate,
    clientName,
    clientAddress,
    items: state.draftItems.map((item) => ({ ...item })),
    notes,
    createdAt: isEditing ? state.invoices.find((inv) => inv.id === state.editingInvoiceId)!.createdAt : Date.now(),
  }

  await db.saveInvoice(invoice)
  if (!isEditing) {
    state.numbering = advanceNumbering(state.numbering)
    await db.saveMeta({ profile: state.profile, numbering: state.numbering })
    state.invoices.unshift(invoice)
  } else {
    const i = state.invoices.findIndex((inv) => inv.id === invoice.id)
    if (i >= 0) state.invoices[i] = invoice
  }

  renderInvoicesTable()
  resetInvoiceForm()
  showTab('history')
})

// --- 履歴・出力 ---
const invoicesBody = document.getElementById('invoices-body') as HTMLTableSectionElement
const historyErrors = document.getElementById('history-errors') as HTMLDivElement

function renderInvoicesTable(): void {
  invoicesBody.innerHTML = state.invoices
    .map((invoice) => {
      const totals = computeInvoiceTotals(invoice.items)
      return `
      <tr>
        <td>${escapeHtml(invoice.number)}</td>
        <td>${escapeHtml(invoice.issueDate)}</td>
        <td>${escapeHtml(invoice.clientName)}</td>
        <td class="num">${formatYen(totals.grandTotalYen)}</td>
        <td>
          <button type="button" data-print="${invoice.id}">印刷/PDF</button>
          <button type="button" class="secondary" data-duplicate="${invoice.id}">複製</button>
          <button type="button" class="danger" data-delete-invoice="${invoice.id}">削除</button>
        </td>
      </tr>`
    })
    .join('')
}

invoicesBody.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement
  const printId = target.dataset.print
  const duplicateId = target.dataset.duplicate
  const deleteId = target.dataset.deleteInvoice

  if (printId) {
    const invoice = state.invoices.find((inv) => inv.id === printId)
    if (invoice) printInvoice(invoice, state.profile)
    return
  }
  if (duplicateId) {
    const invoice = state.invoices.find((inv) => inv.id === duplicateId)
    if (!invoice) return
    state.editingInvoiceId = null
    state.draftItems = invoice.items.map((item) => ({ ...item }))
    ;(invoiceForm.elements.namedItem('invoiceClientName') as HTMLInputElement).value = invoice.clientName
    ;(invoiceForm.elements.namedItem('invoiceClientAddress') as HTMLTextAreaElement).value = invoice.clientAddress
    ;(invoiceForm.elements.namedItem('issueDate') as HTMLInputElement).value = new Date().toISOString().slice(0, 10)
    ;(invoiceForm.elements.namedItem('dueDate') as HTMLInputElement).value = ''
    ;(invoiceForm.elements.namedItem('notes') as HTMLTextAreaElement).value = invoice.notes
    renderItemRows()
    showTab('invoice')
    return
  }
  if (deleteId) {
    await db.deleteInvoice(deleteId)
    state.invoices = state.invoices.filter((inv) => inv.id !== deleteId)
    renderInvoicesTable()
  }
})

document.getElementById('export-csv')!.addEventListener('click', () => {
  const blob = buildInvoiceHistoryCsvBlob(state.invoices)
  downloadBlob(blob, csvDownloadFileName())
})

document.getElementById('export-json')!.addEventListener('click', () => {
  const blob = appDataToJsonBlob({
    formatVersion: 1,
    profile: state.profile,
    numbering: state.numbering,
    clients: state.clients,
    invoices: state.invoices,
  })
  downloadBlob(blob, jsonDownloadFileName())
})

const importJsonBtn = document.getElementById('import-json') as HTMLButtonElement
const importFile = document.getElementById('import-file') as HTMLInputElement
importJsonBtn.addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = parseAppDataFromJsonText(text)
    await db.importAll(parsed)
    await loadAll()
    historyErrors.textContent = 'インポートが完了しました。'
  } catch (err) {
    historyErrors.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function loadAll(): Promise<void> {
  const [meta, clients, invoices] = await Promise.all([db.getMeta(), db.listClients(), db.listInvoices()])
  state.profile = meta.profile
  state.numbering = meta.numbering
  state.clients = clients
  state.invoices = invoices
  fillProfileForm()
  renderClients()
  renderInvoicesTable()
  resetInvoiceForm()
}

showTab('invoice')
loadAll()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応の登録に失敗しても、通常利用は継続できる
    })
  })
}
