import './style.css'
import { calcInvoice, formatYen, lineAmount } from './calc'
import {
  emptyInvoice, validateInvoice, parseNumber, isValidRegistrationNumber, normalizeRegistrationNumber,
  type Invoice, type LineItem, type PriceMode, type Rounding,
} from './model'
import { loadData, saveData, backupToJsonBlob, parseBackup, upsertInvoice, suggestNextNumber, type AppData } from './storage'
import { buildInvoicesCsvBlob, csvFileName, jsonFileName, todayString } from './csv'

const root = document.getElementById('app')
if (!root) throw new Error('#app 要素が見つかりません')

// 静的なHTMLのみ（ユーザー入力は含めない）。ユーザー入力は常に textContent / value で扱う。
root.innerHTML = `
  <div class="screen-only">
    <h1>請求書メーカー（適格請求書対応）</h1>
    <p class="subtitle">請求書を作成し、印刷画面から「PDFに保存」できます。</p>
    <div>
      <span class="badge">登録不要</span>
      <span class="badge">入力データは外部送信されません</span>
      <span class="badge">オフラインでも利用可能</span>
    </div>
    <form id="inv-form" novalidate>
      <fieldset><legend>発行者（あなた）</legend>
        <div class="field"><label for="issuerName">名称・氏名</label><input id="issuerName" maxlength="200" /></div>
        <div class="field"><label for="issuerRegistrationNumber">登録番号（T+数字13桁・適格請求書発行事業者のみ）</label><input id="issuerRegistrationNumber" maxlength="30" placeholder="T1234567890123" /></div>
        <div class="field"><label for="issuerAddress">住所</label><textarea id="issuerAddress" rows="2" maxlength="400"></textarea></div>
        <div class="field"><label for="issuerBank">振込先</label><textarea id="issuerBank" rows="2" maxlength="400"></textarea></div>
      </fieldset>
      <fieldset><legend>請求内容</legend>
        <div class="field"><label for="clientName">請求先の名称</label><input id="clientName" maxlength="200" /></div>
        <div class="field"><label for="subject">件名</label><input id="subject" maxlength="200" /></div>
        <div class="row">
          <div class="field"><label for="invoiceNumber">請求書番号</label><input id="invoiceNumber" maxlength="60" /></div>
          <div class="field"><label for="issueDate">発行日（取引年月日）</label><input type="date" id="issueDate" /></div>
          <div class="field"><label for="dueDate">支払期限</label><input type="date" id="dueDate" /></div>
        </div>
        <div class="row">
          <div class="field"><label for="priceMode">単価の種類</label>
            <select id="priceMode"><option value="exclusive">税抜価格</option><option value="inclusive">税込価格</option></select></div>
          <div class="field"><label for="rounding">消費税の端数処理</label>
            <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
        </div>
      </fieldset>
      <fieldset><legend>明細</legend>
        <div id="items"></div>
        <button type="button" class="secondary" id="add-item">明細を追加</button>
      </fieldset>
      <div class="field"><label for="notes">備考</label><textarea id="notes" rows="2" maxlength="2000"></textarea></div>
      <div class="errors" id="errors" role="alert"></div>
      <div class="status" id="status" role="status"></div>
      <div class="actions">
        <button type="button" id="save">保存</button>
        <button type="button" id="print">印刷 / PDFに保存</button>
        <button type="button" class="secondary" id="new-invoice">新しい請求書</button>
      </div>
    </form>
    <section>
      <h2>保存した請求書</h2>
      <ul id="saved-list" class="saved"></ul>
      <div class="actions">
        <button type="button" class="secondary" id="export-csv">一覧をCSVでダウンロード</button>
        <button type="button" class="secondary" id="export-json">バックアップ(JSON)</button>
        <button type="button" class="secondary" id="import-json">バックアップを読み込む</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      </div>
    </section>
    <h2>プレビュー</h2>
  </div>
  <article id="preview" class="paper" aria-label="請求書プレビュー"></article>
  <footer class="screen-only disclaimer">
    本ツールは書類作成の補助です。税務上の判断は国税庁の最新情報または税理士等の専門家にご確認ください。
    データはこのブラウザ内にのみ保存されます。ブラウザのデータを消去すると失われるため、定期的にバックアップしてください。
  </footer>
`

function $<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id)
  if (!e) throw new Error(`#${id} が見つかりません`)
  return e as T
}

let data: AppData = loadData()
let inv: Invoice = data.draft ?? newInvoice()

function newInvoice(): Invoice {
  const base = emptyInvoice(todayString())
  const last = data?.invoices?.[data.invoices.length - 1]
  if (last) {
    base.issuerName = last.issuerName
    base.issuerRegistrationNumber = last.issuerRegistrationNumber
    base.issuerAddress = last.issuerAddress
    base.issuerBank = last.issuerBank
    base.rounding = last.rounding
  }
  base.invoiceNumber = suggestNextNumber(data?.invoices ?? [])
  return base
}

const TEXT_FIELDS = [
  'issuerName', 'issuerRegistrationNumber', 'issuerAddress', 'issuerBank',
  'clientName', 'subject', 'invoiceNumber', 'issueDate', 'dueDate', 'notes',
] as const

function setStatus(msg: string): void { $('status').textContent = msg }
function setErrors(list: string[]): void { $('errors').textContent = list.join('\n') }

function persistDraft(): void {
  // 入力途中の空欄(NaN)はJSON化でnullになり下書き全体が破棄されるため、0に置換して保存する
  data = { ...data, draft: { ...inv, items: inv.items.map(safeItem) } }
  saveData(data)
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function renderItems(): void {
  const box = $('items')
  box.replaceChildren()
  inv.items.forEach((item, i) => {
    const row = el('div', 'item-row')
    const name = el('input', 'item-name'); name.placeholder = '品名'; name.maxLength = 200; name.value = item.name
    name.setAttribute('aria-label', `明細${i + 1} 品名`)
    const qty = el('input', 'item-qty'); qty.inputMode = 'decimal'; qty.value = String(item.quantity)
    qty.setAttribute('aria-label', `明細${i + 1} 数量`)
    const price = el('input', 'item-price'); price.inputMode = 'decimal'; price.value = String(item.unitPrice)
    price.setAttribute('aria-label', `明細${i + 1} 単価`)
    const rate = el('select', 'item-rate')
    rate.setAttribute('aria-label', `明細${i + 1} 税率`)
    for (const [v, t] of [['10', '10%'], ['8', '8%（軽減）']]) {
      const o = el('option', undefined, t); o.value = v; rate.append(o)
    }
    rate.value = String(item.taxRate)
    const del = el('button', 'secondary small', '削除'); del.type = 'button'
    del.setAttribute('aria-label', `明細${i + 1}を削除`)
    const sync = (): void => {
      const q = parseNumber(qty.value), p = parseNumber(price.value)
      inv.items[i] = { name: name.value, quantity: q, unitPrice: p, taxRate: rate.value === '8' ? 8 : 10 }
      update()
    }
    for (const e of [name, qty, price, rate]) e.addEventListener('input', sync)
    del.addEventListener('click', () => {
      inv.items.splice(i, 1)
      renderItems(); update()
    })
    row.append(name, qty, price, rate, del)
    box.append(row)
  })
}

function fillForm(): void {
  for (const k of TEXT_FIELDS) ($(k) as HTMLInputElement).value = inv[k]
  ;($('priceMode') as HTMLSelectElement).value = inv.priceMode
  ;($('rounding') as HTMLSelectElement).value = inv.rounding
  renderItems()
  update()
}

function fmtDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : s
}

function safeItem(it: LineItem): LineItem {
  return {
    ...it,
    quantity: Number.isFinite(it.quantity) ? it.quantity : 0,
    unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0,
  }
}

function renderPreview(): void {
  const p = $('preview')
  p.replaceChildren()
  const items = inv.items.map(safeItem)
  const t = calcInvoice(items, inv.priceMode, inv.rounding)
  const qualified = isValidRegistrationNumber(inv.issuerRegistrationNumber)

  p.append(el('h2', 'paper-title', qualified ? '請求書（適格請求書）' : '請求書'))
  const head = el('div', 'paper-head')
  const left = el('div')
  left.append(el('div', 'client', (inv.clientName || '（請求先）') + ' 御中'))
  if (inv.subject) left.append(el('div', undefined, '件名: ' + inv.subject))
  const right = el('div', 'right')
  right.append(el('div', undefined, '請求書番号: ' + inv.invoiceNumber))
  right.append(el('div', undefined, '発行日: ' + fmtDate(inv.issueDate)))
  if (inv.dueDate) right.append(el('div', undefined, '支払期限: ' + fmtDate(inv.dueDate)))
  head.append(left, right)
  p.append(head)

  const issuer = el('div', 'issuer')
  issuer.append(el('div', 'strong', inv.issuerName || '（発行者）'))
  if (qualified) issuer.append(el('div', undefined, '登録番号: ' + normalizeRegistrationNumber(inv.issuerRegistrationNumber)))
  if (inv.issuerAddress) issuer.append(el('div', 'pre', inv.issuerAddress))
  p.append(issuer)

  p.append(el('div', 'total-line', `ご請求金額（税込）  ${formatYen(t.total)}`))

  const table = el('table', 'lines')
  const thead = el('thead'); const hr = el('tr')
  for (const h of ['品名', '数量', '単価', '税率', '金額']) hr.append(el('th', undefined, h))
  thead.append(hr); table.append(thead)
  const tb = el('tbody')
  items.forEach((it) => {
    const tr = el('tr')
    tr.append(
      el('td', undefined, it.name + (it.taxRate === 8 ? ' ※' : '')),
      el('td', 'num', String(it.quantity)),
      el('td', 'num', formatYen(Math.round(it.unitPrice))),
      el('td', 'num', it.taxRate + '%'),
      el('td', 'num', formatYen(lineAmount(it))),
    )
    tb.append(tr)
  })
  table.append(tb); p.append(table)
  if (items.some((i) => i.taxRate === 8)) p.append(el('div', 'small-note', '※は軽減税率（8%）対象'))
  const basis = inv.priceMode === 'inclusive' ? '（単価は税込価格）' : '（単価は税抜価格）'
  p.append(el('div', 'small-note', basis))

  const sum = el('table', 'sum')
  const sb = el('tbody')
  const addRow = (label: string, val: string, cls?: string): void => {
    const tr = el('tr', cls); tr.append(el('th', undefined, label), el('td', 'num', val)); sb.append(tr)
  }
  for (const g of t.groups) {
    addRow(`${g.rate}%対象（税抜）`, formatYen(g.taxableAmount))
    addRow(`${g.rate}%消費税額`, formatYen(g.tax))
  }
  addRow('合計（税込）', formatYen(t.total), 'grand')
  sum.append(sb); p.append(sum)

  if (inv.issuerBank) { p.append(el('div', 'strong', '振込先')); p.append(el('div', 'pre', inv.issuerBank)) }
  if (inv.notes) { p.append(el('div', 'strong', '備考')); p.append(el('div', 'pre', inv.notes)) }
  if (!qualified) p.append(el('div', 'small-note', '※ 登録番号が未入力のため、適格請求書の記載事項を満たしません。'))
}

function update(): void {
  renderPreview()
  persistDraft()
  renderSaved()
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (data.invoices.length === 0) { ul.append(el('li', 'empty', 'まだ保存した請求書はありません。')); return }
  data.invoices.forEach((s, idx) => {
    const t = calcInvoice(s.items, s.priceMode, s.rounding)
    const li = el('li')
    const open = el('button', 'link', `${s.invoiceNumber} / ${s.clientName} / ${formatYen(t.total)}`)
    open.type = 'button'
    open.addEventListener('click', () => {
      inv = JSON.parse(JSON.stringify(s)) as Invoice
      fillForm(); setErrors([]); setStatus(`${s.invoiceNumber} を読み込みました。`)
    })
    const del = el('button', 'secondary small', '削除'); del.type = 'button'
    del.setAttribute('aria-label', `${s.invoiceNumber}を削除`)
    del.addEventListener('click', () => {
      if (!window.confirm(`${s.invoiceNumber} を削除しますか？`)) return
      data = { ...data, invoices: data.invoices.filter((_, i) => i !== idx) }
      saveData(data); renderSaved()
    })
    li.append(open, del)
    ul.append(li)
  })
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

for (const k of TEXT_FIELDS) {
  $(k).addEventListener('input', () => {
    inv = { ...inv, [k]: ($(k) as HTMLInputElement).value }
    update()
  })
}
$('priceMode').addEventListener('input', () => { inv.priceMode = ($('priceMode') as HTMLSelectElement).value as PriceMode; update() })
$('rounding').addEventListener('input', () => { inv.rounding = ($('rounding') as HTMLSelectElement).value as Rounding; update() })
$('add-item').addEventListener('click', () => {
  inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
  renderItems(); update()
})
$('save').addEventListener('click', () => {
  const errs = validateInvoice(inv)
  setErrors(errs)
  if (errs.length) { setStatus(''); return }
  inv = { ...inv, issuerRegistrationNumber: inv.issuerRegistrationNumber ? normalizeRegistrationNumber(inv.issuerRegistrationNumber) : '' }
  data = { invoices: upsertInvoice(data.invoices, JSON.parse(JSON.stringify(inv)) as Invoice), draft: inv }
  saveData(data); fillForm()
  setStatus(`${inv.invoiceNumber} を保存しました。`)
})
$('print').addEventListener('click', () => {
  const errs = validateInvoice(inv)
  setErrors(errs)
  if (errs.length) return
  window.print()
})
$('new-invoice').addEventListener('click', () => {
  inv = newInvoice(); fillForm(); setErrors([]); setStatus('新しい請求書を作成しました。')
})
$('export-csv').addEventListener('click', () => {
  if (data.invoices.length === 0) { setStatus('保存した請求書がありません。'); return }
  download(buildInvoicesCsvBlob(data.invoices), csvFileName())
})
$('export-json').addEventListener('click', () => {
  download(backupToJsonBlob(data.invoices), jsonFileName())
})
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$('import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 10_000_000) throw new Error('ファイルが大きすぎます（10MBまで）。')
    const list = parseBackup(await file.text())
    let merged = data.invoices
    for (const x of list) merged = upsertInvoice(merged, x)
    data = { ...data, invoices: merged }
    saveData(data); renderSaved(); setErrors([])
    setStatus(`${list.length}件の請求書を読み込みました。`)
  } catch (err) {
    setErrors([err instanceof Error ? err.message : '読み込みに失敗しました。'])
  } finally {
    input.value = ''
  }
})

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}

fillForm()
