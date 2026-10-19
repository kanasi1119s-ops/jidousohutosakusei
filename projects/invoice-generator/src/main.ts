import './style.css'
import {
  calcTotals,
  formatYen,
  isValidRegistrationNumber,
  MAX_LINE_AMOUNT,
  parseNumber,
  toHalfWidth,
  type LineItem,
  type TaxRate,
} from './calc'
import { emptyInvoice, validateInvoice, type Invoice } from './model'
import { exportJsonBlob, loadInvoices, mergeInvoices, parseImport, saveInvoices, upsertInvoice } from './storage'
import { buildInvoiceListCsvBlob, csvFileName, jsonFileName } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>請求書ジェネレーター</h1>
  <p class="subtitle">インボイス制度（適格請求書）の記載事項に沿った請求書を作成し、印刷またはPDFとして保存できます。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>

  <fieldset>
    <legend>発行者（あなた）</legend>
    <div class="grid">
      <div class="field"><label for="issuerName">氏名または名称</label><input id="issuerName" autocomplete="off" /></div>
      <div class="field"><label for="registrationNumber">登録番号（T+数字13桁・未登録なら空欄）</label><input id="registrationNumber" placeholder="T1234567890123" autocomplete="off" /></div>
      <div class="field wide"><label for="issuerAddress">住所</label><input id="issuerAddress" autocomplete="off" /></div>
      <div class="field"><label for="issuerContact">連絡先（電話・メール）</label><input id="issuerContact" autocomplete="off" /></div>
      <div class="field wide"><label for="bank">振込先</label><textarea id="bank"></textarea></div>
    </div>
  </fieldset>

  <fieldset>
    <legend>請求先・請求内容</legend>
    <div class="grid">
      <div class="field"><label for="clientName">請求先名</label><input id="clientName" autocomplete="off" /></div>
      <div class="field"><label for="honorific">敬称</label><select id="honorific"><option value="御中">御中</option><option value="様">様</option></select></div>
      <div class="field"><label for="number">請求書番号</label><input id="number" autocomplete="off" /></div>
      <div class="field"><label for="issueDate">発行日（取引年月日）</label><input id="issueDate" type="date" /></div>
      <div class="field"><label for="dueDate">支払期限</label><input id="dueDate" type="date" /></div>
      <div class="field wide"><label for="subject">件名</label><input id="subject" autocomplete="off" /></div>
    </div>
  </fieldset>

  <fieldset>
    <legend>明細</legend>
    <div class="grid">
      <div class="field"><label for="priceMode">単価の区分</label>
        <select id="priceMode"><option value="exclusive">税抜価格で入力</option><option value="inclusive">税込価格で入力</option></select></div>
      <div class="field"><label for="rounding">消費税の端数処理</label>
        <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
      <div class="field"><label for="withholding">源泉徴収（報酬・料金等）</label>
        <select id="withholding"><option value="no">しない</option><option value="yes">する（10.21% / 100万円超は20.42%）</option></select></div>
    </div>
    <div class="items-wrap">
      <table class="items">
        <thead><tr><th>品名・サービス内容</th><th>数量</th><th>単価（円）</th><th>税率</th><th>金額</th><th></th></tr></thead>
        <tbody id="items-body"></tbody>
      </table>
    </div>
    <div class="actions"><button type="button" class="secondary" id="add-item">明細を追加</button></div>
  </fieldset>

  <fieldset>
    <legend>備考</legend>
    <div class="field"><label for="notes" class="hidden">備考</label><textarea id="notes"></textarea></div>
  </fieldset>

  <div class="messages" id="messages" role="alert"></div>
  <div class="notice" id="notice" role="status"></div>

  <div class="actions">
    <button type="button" id="save">この請求書を保存</button>
    <button type="button" id="print">印刷 / PDFとして保存</button>
    <button type="button" class="secondary" id="new-invoice">新しい請求書</button>
  </div>

  <section id="preview-section">
    <h2>プレビュー</h2>
    <div class="sheet" id="preview"></div>
  </section>

  <h2>保存済みの請求書</h2>
  <p class="subtitle">このブラウザ内にのみ保存されています。ブラウザのデータを消去すると失われるため、定期的にバックアップ（JSON）を取ってください。</p>
  <ul class="saved" id="saved-list"></ul>
  <div class="actions">
    <button type="button" class="secondary" id="export-json">バックアップ(JSON)</button>
    <button type="button" class="secondary" id="import-json">バックアップを読み込む</button>
    <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
    <button type="button" class="secondary" id="export-csv">一覧をCSVでダウンロード</button>
  </div>

  <p class="disclaimer">
    本ツールの計算結果・書式は一般的な目安であり、税務・法律上の助言ではありません。インボイス制度、消費税、源泉徴収の取扱いは国税庁の公表資料で最新情報をご確認のうえ、必要に応じて税理士等の専門家へご相談ください。
    源泉徴収の計算は、報酬・料金等で消費税額が区分されている場合の税抜金額を基にした簡易計算です。
  </p>
`

// ---------- DOM ヘルパー ----------
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) if (v !== undefined) e.setAttribute(k, v)
  for (const c of children) e.append(c)
  return e
}

// ---------- 状態 ----------
let invoices: Invoice[] = loadInvoices()
let currentId = emptyInvoice().id

function latestIssuer(): Invoice['issuer'] | undefined {
  return invoices.length ? invoices[invoices.length - 1].issuer : undefined
}

const itemsBody = $('items-body')

function addItemRow(item: LineItem): void {
  const tr = el('tr')
  const name = el('input', { class: 'it-name', 'aria-label': '品名', autocomplete: 'off' })
  name.value = item.name
  const qty = el('input', { class: 'it-qty', inputmode: 'decimal', 'aria-label': '数量' })
  qty.value = String(item.quantity)
  const price = el('input', { class: 'it-price', inputmode: 'numeric', 'aria-label': '単価' })
  price.value = String(item.unitPrice)
  const rate = el('select', { class: 'it-rate', 'aria-label': '税率' })
  for (const [v, label] of [['10', '10%'], ['8', '8%（軽減）'], ['0', '非課税・不課税']]) {
    const o = el('option', { value: v }, label)
    rate.append(o)
  }
  rate.value = String(item.taxRate)
  const amount = el('td', { class: 'amount' })
  const del = el('button', { type: 'button', class: 'danger small', 'aria-label': '明細を削除' }, '削除')
  del.addEventListener('click', () => {
    if (itemsBody.children.length > 1) tr.remove()
    refresh()
  })
  for (const c of [name, qty, price, rate]) tr.append(el('td', {}, c))
  tr.append(amount, el('td', {}, del))
  itemsBody.append(tr)
}

function setForm(inv: Invoice): void {
  currentId = inv.id
  $<HTMLInputElement>('issuerName').value = inv.issuer.name
  $<HTMLInputElement>('registrationNumber').value = inv.issuer.registrationNumber
  $<HTMLInputElement>('issuerAddress').value = inv.issuer.address
  $<HTMLInputElement>('issuerContact').value = inv.issuer.contact
  $<HTMLTextAreaElement>('bank').value = inv.issuer.bank
  $<HTMLInputElement>('clientName').value = inv.clientName
  $<HTMLSelectElement>('honorific').value = inv.honorific
  $<HTMLInputElement>('number').value = inv.number
  $<HTMLInputElement>('issueDate').value = inv.issueDate
  $<HTMLInputElement>('dueDate').value = inv.dueDate
  $<HTMLInputElement>('subject').value = inv.subject
  $<HTMLSelectElement>('priceMode').value = inv.priceMode
  $<HTMLSelectElement>('rounding').value = inv.rounding
  $<HTMLSelectElement>('withholding').value = inv.withholding ? 'yes' : 'no'
  $<HTMLTextAreaElement>('notes').value = inv.notes
  itemsBody.replaceChildren()
  for (const it of inv.items.length ? inv.items : [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 as TaxRate }]) addItemRow(it)
  refresh()
}

/** フォームから Invoice を組み立てる。数値の解釈エラーは errors に積む。 */
function readForm(errors: string[]): Invoice {
  const v = (id: string): string => $<HTMLInputElement>(id).value
  const items: LineItem[] = []
  Array.from(itemsBody.children).forEach((tr, i) => {
    const q = (cls: string): HTMLInputElement => tr.querySelector(cls) as HTMLInputElement
    const qty = parseNumber(q('.it-qty').value)
    const price = parseNumber(q('.it-price').value)
    if (!Number.isFinite(qty)) errors.push(`明細${i + 1}: 数量は数値で入力してください。`)
    if (!Number.isFinite(price)) errors.push(`明細${i + 1}: 単価は数値で入力してください。`)
    const safeQty = Number.isFinite(qty) ? qty : 0
    const safePrice = Number.isFinite(price) ? Math.round(price) : 0
    const tooBig = Math.abs(safeQty * safePrice) > MAX_LINE_AMOUNT
    if (tooBig) errors.push(`明細${i + 1}: 金額が大きすぎます（1行あたり1兆円まで）。`)
    items.push({
      name: q('.it-name').value,
      quantity: tooBig ? 0 : safeQty,
      unitPrice: tooBig ? 0 : safePrice,
      taxRate: Number(q('.it-rate').value) as TaxRate,
    })
  })
  const reg = toHalfWidth(v('registrationNumber')).trim().toUpperCase()
  if (!isValidRegistrationNumber(reg)) errors.push('登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。')
  return {
    id: currentId,
    number: v('number'),
    issueDate: v('issueDate'),
    dueDate: v('dueDate'),
    issuer: {
      name: v('issuerName'),
      address: v('issuerAddress'),
      contact: v('issuerContact'),
      registrationNumber: reg,
      bank: v('bank'),
    },
    clientName: v('clientName'),
    honorific: v('honorific') === '様' ? '様' : '御中',
    subject: v('subject'),
    items,
    priceMode: v('priceMode') === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: (['floor', 'round', 'ceil'].includes(v('rounding')) ? v('rounding') : 'floor') as Invoice['rounding'],
    withholding: v('withholding') === 'yes',
    notes: v('notes'),
  }
}

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function renderPreview(inv: Invoice): void {
  const t = calcTotals(inv.items, inv.priceMode, inv.rounding, inv.withholding)
  const preview = $('preview')
  const label = inv.priceMode === 'inclusive' ? '（税込）' : '（税抜）'

  const from = el('div', { class: 'from' })
  from.textContent = [
    inv.issuer.name,
    inv.issuer.address,
    inv.issuer.contact,
    inv.issuer.registrationNumber ? `登録番号: ${inv.issuer.registrationNumber}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const to = el('div', {}, el('span', { class: 'to', id: 'pv-client' }, `${inv.clientName || '（請求先名）'} ${inv.honorific}`))
  const meta = el('div', {})
  meta.textContent = [
    inv.number ? `請求書番号: ${inv.number}` : '',
    inv.issueDate ? `発行日: ${fmtDate(inv.issueDate)}` : '',
    inv.dueDate ? `支払期限: ${fmtDate(inv.dueDate)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  meta.style.whiteSpace = 'pre-wrap'
  const left = el('div', {}, to, el('p', {}, inv.subject ? `件名: ${inv.subject}` : ''), meta)

  const itemsTable = el('table', {}, el('thead', {}, el('tr', {}, ...['品名・サービス内容', '数量', '単価', '税率', `金額${label}`].map((h) => el('th', {}, h)))))
  const tb = el('tbody')
  inv.items.forEach((it, i) => {
    const rateText = it.taxRate === 8 ? '8%（軽減税率）' : it.taxRate === 10 ? '10%' : '非課税・不課税'
    const cells = [
      el('td', {}, it.name || '（品名）'),
      el('td', { class: 'num' }, String(it.quantity)),
      el('td', { class: 'num' }, formatYen(it.unitPrice)),
      el('td', {}, rateText),
      el('td', { class: 'num' }, formatYen(t.lineAmounts[i])),
    ]
    tb.append(el('tr', {}, ...cells))
  })
  itemsTable.append(tb)

  const sum = el('table', { class: 'sum' })
  const row = (a: string, b: string): HTMLElement => el('tr', {}, el('th', {}, a), el('td', { class: 'num' }, b))
  for (const g of t.groups) {
    const name = g.rate === 0 ? '非課税・不課税' : `${g.rate}%対象`
    sum.append(row(`${name} 税抜金額`, formatYen(g.base)))
    if (g.rate !== 0) sum.append(row(`${name} 消費税額`, formatYen(g.tax)))
  }
  sum.append(row('合計（税込）', formatYen(t.total)))
  if (inv.withholding) sum.append(row('源泉徴収税額', `-${formatYen(t.withholding)}`))
  sum.append(row('ご請求額', formatYen(t.payable)))

  const totalLine = el('div', { class: 'total-line', id: 'pv-total' }, `ご請求額 ${formatYen(t.payable)}`)
  const bank = el('div', { class: 'pre' })
  if (inv.issuer.bank) bank.textContent = `【振込先】\n${inv.issuer.bank}`
  const notes = el('div', { class: 'pre' })
  if (inv.notes) notes.textContent = `【備考】\n${inv.notes}`

  const head = el('div', { class: 'head' }, left, from)
  preview.replaceChildren(el('h3', {}, '請求書'), head, totalLine, itemsTable, sum, bank, notes)

  // 明細行の金額セルも更新
  Array.from(itemsBody.children).forEach((tr, i) => {
    const cell = tr.querySelector('.amount')
    if (cell) cell.textContent = formatYen(t.lineAmounts[i] ?? 0)
  })
}

function refresh(): void {
  const errors: string[] = []
  const inv = readForm(errors)
  $('messages').textContent = errors.join(' ')
  renderPreview(inv)
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (invoices.length === 0) {
    ul.append(el('li', {}, '保存済みの請求書はまだありません。'))
    return
  }
  for (const inv of invoices) {
    const t = calcTotals(inv.items, inv.priceMode, inv.rounding, inv.withholding)
    const label = el('span', { class: 'label' }, `${inv.number || '(番号なし)'} / ${inv.clientName || '(請求先なし)'} / ${formatYen(t.payable)}`)
    const open = el('button', { type: 'button', class: 'secondary small' }, '開く')
    open.addEventListener('click', () => {
      setForm(inv)
      notice(`請求書「${inv.number || '番号なし'}」を開きました。`)
    })
    const copy = el('button', { type: 'button', class: 'secondary small' }, '複製')
    copy.addEventListener('click', () => {
      const dup = validateInvoice(JSON.parse(JSON.stringify(inv)))
      dup.id = emptyInvoice().id
      dup.number = ''
      setForm(dup)
      notice('複製しました。請求書番号を入力して保存してください。')
    })
    const del = el('button', { type: 'button', class: 'danger small' }, '削除')
    del.addEventListener('click', () => {
      if (!window.confirm('この請求書を削除しますか？（元に戻せません）')) return
      invoices = invoices.filter((x) => x.id !== inv.id)
      persist()
      renderSaved()
    })
    ul.append(el('li', {}, label, open, copy, del))
  }
}

function notice(msg: string): void {
  $('notice').textContent = msg
}

function persist(): boolean {
  const ok = saveInvoices(invoices)
  if (!ok) $('messages').textContent = 'ブラウザへの保存に失敗しました。バックアップ(JSON)をダウンロードしてください。'
  return ok
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

// ---------- イベント ----------
app.addEventListener('input', refresh)
app.addEventListener('change', refresh)

$('add-item').addEventListener('click', () => {
  if (itemsBody.children.length >= 200) return
  addItemRow({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
  refresh()
})

$('save').addEventListener('click', () => {
  const errors: string[] = []
  const inv = readForm(errors)
  if (errors.length) {
    $('messages').textContent = errors.join(' ')
    return
  }
  if (!inv.number.trim()) {
    $('messages').textContent = '保存するには請求書番号を入力してください。'
    return
  }
  invoices = upsertInvoice(invoices, inv)
  if (persist()) {
    $('messages').textContent = ''
    notice('保存しました（このブラウザ内のみ）。')
  }
  renderSaved()
})

$('print').addEventListener('click', () => {
  const errors: string[] = []
  readForm(errors)
  if (errors.length) {
    $('messages').textContent = errors.join(' ')
    return
  }
  window.print()
})

$('new-invoice').addEventListener('click', () => {
  setForm(emptyInvoice(latestIssuer()))
  notice('新しい請求書を作成します。')
})

$('export-json').addEventListener('click', () => download(exportJsonBlob(invoices), jsonFileName()))
$('export-csv').addEventListener('click', () => download(buildInvoiceListCsvBlob(invoices), csvFileName()))
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-file').click())
$('import-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const incoming = parseImport(await file.text())
    invoices = mergeInvoices(invoices, incoming)
    persist()
    renderSaved()
    $('messages').textContent = ''
    notice(`${incoming.length}件の請求書を読み込みました。`)
  } catch (e) {
    $('messages').textContent = e instanceof Error ? e.message : '読み込みに失敗しました。'
  }
})

setForm(emptyInvoice(latestIssuer()))
renderSaved()

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
