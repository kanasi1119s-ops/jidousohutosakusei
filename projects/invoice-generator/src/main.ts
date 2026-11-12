import './style.css'
import {
  computeTotals, emptyIssuer, formatYen, nextInvoiceNumber, normalizeRegistrationNumber, parseNumber,
  validateInvoice, type Invoice, type LineItem, type RoundingMode, type TaxRate,
} from './calc'
import { buildInvoicesCsvBlob, csvDownloadFileName, jsonDownloadFileName } from './csv'
import { loadData, mergeInvoices, parseBackup, saveData, serializeBackup, type AppData } from './storage'

const app = document.querySelector<HTMLDivElement>('#app')!
// 固定のテンプレート（ユーザー入力は含まない）。ユーザー入力は常に textContent / value 経由で表示する。
app.innerHTML = `
<header class="top no-print">
  <h1>請求書ジェネレーター</h1>
  <p class="subtitle">インボイス（適格請求書）の記載事項に対応。作成した請求書はPDFとして保存・印刷できます。</p>
  <span class="privacy-badge">登録不要</span><span class="privacy-badge">入力データは端末内のみに保存</span><span class="privacy-badge">オフライン対応</span>
</header>
<main class="layout">
  <section class="editor no-print" aria-label="請求書の入力">
    <div class="toolbar">
      <button type="button" id="new-invoice">新規作成</button>
      <button type="button" id="save-invoice" class="primary">保存</button>
      <button type="button" id="print">印刷 / PDFで保存</button>
    </div>
    <div id="errors" class="errors" role="alert"></div>
    <div id="status" class="status" role="status"></div>
    <fieldset><legend>請求書の情報</legend>
      <div class="grid">
        <label>請求書番号<input id="inv-number" type="text" autocomplete="off"></label>
        <label>発行日<input id="inv-issue-date" type="date"></label>
        <label>支払期限<input id="inv-due-date" type="date"></label>
        <label>消費税の端数処理<select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></label>
      </div>
      <label class="check"><input id="inv-qualified" type="checkbox" checked> 適格請求書（登録番号を記載）として発行する</label>
    </fieldset>
    <fieldset><legend>発行者（自社）</legend>
      <div class="grid">
        <label>氏名または名称<input id="issuer-name" type="text" autocomplete="off"></label>
        <label>登録番号（T＋13桁）<input id="issuer-reg" type="text" inputmode="text" autocomplete="off" placeholder="T1234567890123"></label>
      </div>
      <label>住所<textarea id="issuer-address" rows="2"></textarea></label>
      <label>振込先<textarea id="issuer-bank" rows="2"></textarea></label>
    </fieldset>
    <fieldset><legend>請求先</legend>
      <label>請求先名（御中・様は不要）<input id="client-name" type="text" autocomplete="off"></label>
    </fieldset>
    <fieldset><legend>明細</legend>
      <div class="table-wrap"><table class="items-edit"><thead><tr><th>品目</th><th>数量</th><th>単価(円・税抜)</th><th>税率</th><th></th></tr></thead><tbody id="items-body"></tbody></table></div>
      <button type="button" id="add-item">＋ 明細を追加</button>
    </fieldset>
    <fieldset><legend>備考</legend><textarea id="notes" rows="2"></textarea></fieldset>
    <fieldset><legend>保存済みの請求書</legend>
      <ul id="saved-list" class="saved-list"></ul>
      <div class="toolbar">
        <button type="button" id="export-csv">CSVで書き出し</button>
        <button type="button" id="export-json">バックアップ(JSON)を書き出し</button>
        <label class="file-btn">バックアップを読み込み<input id="import-file" type="file" accept="application/json,.json"></label>
      </div>
    </fieldset>
    <p class="note">本ツールは請求書の作成を補助するものです。記載内容・税額の最終確認は発行者の責任で行ってください。税務・法律の助言ではありません。</p>
  </section>
  <section class="preview-wrap" aria-label="プレビュー">
    <article id="preview" class="paper">
      <h2 id="pv-title"></h2>
      <div class="pv-head">
        <div><div class="pv-client"><span id="pv-client"></span> 御中</div></div>
        <div class="pv-meta"><div>請求書番号: <span id="pv-number"></span></div><div>発行日: <span id="pv-issue"></span></div><div id="pv-due-row">支払期限: <span id="pv-due"></span></div></div>
      </div>
      <div class="pv-issuer"><strong id="pv-issuer-name"></strong><div id="pv-issuer-reg"></div><div id="pv-issuer-address" class="pre"></div></div>
      <p class="pv-total-line">ご請求金額（税込） <strong id="pv-total"></strong></p>
      <table class="pv-items"><thead><tr><th>品目</th><th class="num">数量</th><th class="num">単価</th><th class="num">税率</th><th class="num">金額(税抜)</th></tr></thead><tbody id="pv-items"></tbody></table>
      <table class="pv-groups"><thead><tr><th>税率区分</th><th class="num">税抜合計</th><th class="num">消費税額</th><th class="num">税込合計</th></tr></thead><tbody id="pv-groups"></tbody></table>
      <div class="pv-bank-wrap"><strong>お振込先</strong><div id="pv-bank" class="pre"></div></div>
      <div class="pv-notes-wrap"><strong>備考</strong><div id="pv-notes" class="pre"></div></div>
    </article>
  </section>
</main>`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const itemsBody = $<HTMLTableSectionElement>('items-body')

let data: AppData = loadData()
let currentId = ''
const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setStatus(msg: string): void {
  $('status').textContent = msg
}

function addRow(item: LineItem): void {
  const tr = document.createElement('tr')
  const mk = (cls: string, value: string, label: string, mode?: string): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = 'text'
    i.className = cls
    i.value = value
    i.setAttribute('aria-label', label)
    if (mode) i.inputMode = mode
    i.autocomplete = 'off'
    return i
  }
  const cell = (el: HTMLElement): HTMLTableCellElement => {
    const td = document.createElement('td')
    td.appendChild(el)
    return td
  }
  const sel = document.createElement('select')
  sel.className = 'item-rate'
  sel.setAttribute('aria-label', '税率')
  for (const r of [10, 8]) {
    const o = document.createElement('option')
    o.value = String(r)
    o.textContent = r === 8 ? '8%（軽減）' : '10%'
    sel.appendChild(o)
  }
  sel.value = String(item.taxRate)
  const rm = document.createElement('button')
  rm.type = 'button'
  rm.className = 'item-remove'
  rm.textContent = '削除'
  tr.append(
    cell(mk('item-desc', item.description, '品目')),
    cell(mk('item-qty', Number.isFinite(item.quantity) ? String(item.quantity) : '', '数量', 'decimal')),
    cell(mk('item-price', Number.isFinite(item.unitPriceYen) ? String(item.unitPriceYen) : '', '単価', 'numeric')),
    cell(sel),
    cell(rm),
  )
  itemsBody.appendChild(tr)
}

function readForm(): Invoice {
  const items: LineItem[] = Array.from(itemsBody.children).map((tr) => {
    const v = (cls: string): string => (tr.querySelector<HTMLInputElement>('.' + cls)?.value ?? '')
    return {
      description: v('item-desc'),
      quantity: parseNumber(v('item-qty')) ?? NaN,
      unitPriceYen: parseNumber(v('item-price')) ?? NaN,
      taxRate: (v('item-rate') === '8' ? 8 : 10) as TaxRate,
    }
  })
  return {
    id: currentId,
    number: $<HTMLInputElement>('inv-number').value,
    issueDate: $<HTMLInputElement>('inv-issue-date').value,
    dueDate: $<HTMLInputElement>('inv-due-date').value,
    qualified: $<HTMLInputElement>('inv-qualified').checked,
    issuer: {
      name: $<HTMLInputElement>('issuer-name').value,
      registrationNumber: normalizeRegistrationNumber($<HTMLInputElement>('issuer-reg').value),
      address: $<HTMLTextAreaElement>('issuer-address').value,
      bank: $<HTMLTextAreaElement>('issuer-bank').value,
    },
    clientName: $<HTMLInputElement>('client-name').value,
    items,
    rounding: $<HTMLSelectElement>('rounding').value as RoundingMode,
    notes: $<HTMLTextAreaElement>('notes').value,
    updatedAt: new Date().toISOString(),
  }
}

function writeForm(inv: Invoice): void {
  currentId = inv.id
  $<HTMLInputElement>('inv-number').value = inv.number
  $<HTMLInputElement>('inv-issue-date').value = inv.issueDate
  $<HTMLInputElement>('inv-due-date').value = inv.dueDate
  $<HTMLInputElement>('inv-qualified').checked = inv.qualified
  $<HTMLInputElement>('issuer-name').value = inv.issuer.name
  $<HTMLInputElement>('issuer-reg').value = inv.issuer.registrationNumber
  $<HTMLTextAreaElement>('issuer-address').value = inv.issuer.address
  $<HTMLTextAreaElement>('issuer-bank').value = inv.issuer.bank
  $<HTMLInputElement>('client-name').value = inv.clientName
  $<HTMLSelectElement>('rounding').value = inv.rounding
  $<HTMLTextAreaElement>('notes').value = inv.notes
  itemsBody.replaceChildren()
  inv.items.forEach(addRow)
  refresh()
}

function newInvoice(): Invoice {
  return {
    id: '', number: nextInvoiceNumber(data.invoices.map((i) => i.number)), issueDate: todayStr(), dueDate: '',
    qualified: true, issuer: { ...(data.defaultIssuer ?? emptyIssuer()) }, clientName: '',
    items: [{ description: '', quantity: 1, unitPriceYen: NaN, taxRate: 10 }], rounding: 'floor', notes: '', updatedAt: '',
  }
}

function td(text: string, cls = ''): HTMLTableCellElement {
  const c = document.createElement('td')
  c.textContent = text
  if (cls) c.className = cls
  return c
}

function refresh(): void {
  const inv = readForm()
  const errors = validateInvoice(inv)
  const errBox = $('errors')
  errBox.replaceChildren(...errors.map((e) => Object.assign(document.createElement('div'), { textContent: e })))
  const totals = computeTotals(inv.items, inv.rounding)
  $('pv-title').textContent = inv.qualified ? '請求書（適格請求書）' : '請求書'
  $('pv-client').textContent = inv.clientName
  $('pv-number').textContent = inv.number
  $('pv-issue').textContent = inv.issueDate
  $('pv-due').textContent = inv.dueDate
  $('pv-due-row').classList.toggle('hidden', inv.dueDate === '')
  $('pv-issuer-name').textContent = inv.issuer.name
  $('pv-issuer-reg').textContent = inv.qualified && inv.issuer.registrationNumber ? `登録番号: ${inv.issuer.registrationNumber}` : ''
  $('pv-issuer-address').textContent = inv.issuer.address
  $('pv-total').textContent = formatYen(totals.totalYen)
  $('pv-bank').textContent = inv.issuer.bank
  $('pv-notes').textContent = inv.notes
  $('pv-items').replaceChildren(
    ...inv.items.map((it, i) => {
      const tr = document.createElement('tr')
      tr.append(
        td(it.description + (it.taxRate === 8 ? ' ※' : '')),
        td(Number.isFinite(it.quantity) ? String(it.quantity) : '-', 'num'),
        td(Number.isFinite(it.unitPriceYen) ? formatYen(it.unitPriceYen) : '-', 'num'),
        td(`${it.taxRate}%`, 'num'),
        td(formatYen(totals.lineAmounts[i]), 'num'),
      )
      return tr
    }),
  )
  $('pv-groups').replaceChildren(
    ...totals.groups.map((g) => {
      const tr = document.createElement('tr')
      tr.append(
        td(g.rate === 8 ? '8%対象（※軽減税率）' : '10%対象'),
        td(formatYen(g.subtotalYen), 'num'),
        td(formatYen(g.taxYen), 'num'),
        td(formatYen(g.totalYen), 'num'),
      )
      return tr
    }),
  )
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (data.invoices.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'まだ保存された請求書はありません。'
    ul.appendChild(li)
    return
  }
  const sorted = [...data.invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const inv of sorted) {
    const li = document.createElement('li')
    li.dataset.id = inv.id
    const label = document.createElement('span')
    const total = computeTotals(inv.items, inv.rounding).totalYen
    label.textContent = `${inv.number} / ${inv.clientName || '(請求先未入力)'} / ${formatYen(total)}`
    const load = document.createElement('button')
    load.type = 'button'
    load.className = 'saved-load'
    load.textContent = '開く'
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'saved-delete'
    del.textContent = '削除'
    li.append(label, load, del)
    ul.appendChild(li)
  }
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

function persist(): boolean {
  const ok = saveData(data)
  if (!ok) setStatus('保存に失敗しました（ブラウザの保存領域が使えません）。バックアップの書き出しをお勧めします。')
  return ok
}

// ---- イベント ----
const editor = document.querySelector('.editor')!
editor.addEventListener('input', refresh)
editor.addEventListener('change', refresh)

itemsBody.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.item-remove')
  if (!btn) return
  btn.closest('tr')?.remove()
  refresh()
})
$('add-item').addEventListener('click', () => {
  addRow({ description: '', quantity: 1, unitPriceYen: NaN, taxRate: 10 })
  refresh()
})
$('new-invoice').addEventListener('click', () => {
  writeForm(newInvoice())
  setStatus('新しい請求書を作成しました。')
})
$('save-invoice').addEventListener('click', () => {
  const inv = readForm()
  const errors = validateInvoice(inv)
  if (errors.length > 0) {
    setStatus('入力内容に問題があるため保存できません。')
    return
  }
  if (inv.id === '') inv.id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now())
  currentId = inv.id
  data = { ...data, defaultIssuer: inv.issuer, invoices: mergeInvoices(data.invoices, [inv]) }
  if (persist()) setStatus(`請求書 ${inv.number} を保存しました。`)
  renderSaved()
})
$('saved-list').addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const li = target.closest('li')
  const id = li?.dataset.id
  if (!id) return
  if (target.classList.contains('saved-load')) {
    const inv = data.invoices.find((i) => i.id === id)
    if (inv) {
      writeForm(inv)
      setStatus(`請求書 ${inv.number} を開きました。`)
    }
  } else if (target.classList.contains('saved-delete')) {
    if (!window.confirm('この請求書を削除します。よろしいですか？')) return
    data = { ...data, invoices: data.invoices.filter((i) => i.id !== id) }
    if (currentId === id) currentId = ''
    persist()
    renderSaved()
    setStatus('削除しました。')
  }
})
$('print').addEventListener('click', () => window.print())
$('export-csv').addEventListener('click', () => {
  if (data.invoices.length === 0) {
    setStatus('書き出す請求書がありません。先に保存してください。')
    return
  }
  download(buildInvoicesCsvBlob(data.invoices), csvDownloadFileName())
})
$('export-json').addEventListener('click', () => {
  download(new Blob([serializeBackup(data)], { type: 'application/json;charset=utf-8' }), jsonDownloadFileName())
})
$<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported = parseBackup(await file.text())
    data = {
      ...data,
      defaultIssuer: imported.defaultIssuer.name ? imported.defaultIssuer : data.defaultIssuer,
      invoices: mergeInvoices(data.invoices, imported.invoices),
    }
    persist()
    renderSaved()
    setStatus(`${imported.invoices.length}件の請求書を読み込みました。`)
  } catch (err) {
    setStatus(err instanceof Error ? err.message : '読み込みに失敗しました。')
  }
  input.value = ''
})

writeForm(newInvoice())
renderSaved()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
