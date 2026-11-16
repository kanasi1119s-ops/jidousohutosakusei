import './style.css'
import {
  computeInvoice, lineAmount, validateInvoice,
  type Invoice, type Item, type PriceMode, type Rounding, type TaxRate,
} from './calc'
import { buildInvoiceCsv, csvFileName, downloadBlob, safeFileStem } from './csv'
import { loadStore, newId, normalizeInvoice, parseImport, saveStore, serializeStore, type StoreData } from './store'

const yen = (n: number): string => (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('ja-JP')

/** 全角数字・全角記号を半角に直す（カンマ・空白は除去） */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー]/g, '-')
    .replace(/[．]/g, '.')
    .replace(/[,，、\s]/g, '')
}

function parseNum(s: string): number {
  const t = toHalfWidth(s)
  // 16進・指数表記などを弾き、通常の10進数のみ受け付ける
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function jpDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}

const app = document.getElementById('app')!
app.innerHTML = `
<div class="wrap">
  <header class="no-print">
    <h1>インボイス対応 請求書ジェネレーター</h1>
    <p class="lead">登録不要・オフライン対応。入力内容はこのブラウザの中にだけ保存され、外部へ送信されません。</p>
  </header>
  <div class="layout">
    <div class="no-print" id="form-col">
      <section class="card">
        <h2>発行者（あなた）</h2>
        <label for="issuerName">氏名・屋号・会社名</label><input id="issuerName" autocomplete="off" />
        <label for="issuerReg">適格請求書発行事業者の登録番号（T＋13桁）</label><input id="issuerReg" placeholder="T1234567890123" autocomplete="off" />
        <label for="issuerAddress">住所</label><textarea id="issuerAddress"></textarea>
        <label for="issuerBank">振込先</label><textarea id="issuerBank"></textarea>
      </section>
      <section class="card">
        <h2>請求内容</h2>
        <div class="row2">
          <div><label for="invNumber">請求番号</label><input id="invNumber" autocomplete="off" /></div>
          <div><label for="clientName">請求先（御中は自動付与）</label><input id="clientName" autocomplete="off" /></div>
          <div><label for="issueDate">発行日</label><input id="issueDate" type="date" /></div>
          <div><label for="dueDate">支払期限</label><input id="dueDate" type="date" /></div>
        </div>
        <label for="subject">件名</label><input id="subject" autocomplete="off" />
        <div class="row2">
          <div><label for="priceMode">金額の入力方法</label>
            <select id="priceMode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select></div>
          <div><label for="rounding">消費税の端数処理</label>
            <select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></div>
        </div>
        <div id="items"></div>
        <div class="actions"><button type="button" id="add-item">＋ 明細を追加</button></div>
        <label class="check"><input type="checkbox" id="withholding" />源泉徴収税額を差し引く（報酬・料金の支払を受ける場合）</label>
        <label for="notes">備考</label><textarea id="notes"></textarea>
      </section>
      <section class="card">
        <div id="errors" aria-live="polite"></div>
        <div class="actions">
          <button type="button" class="primary" id="save">保存</button>
          <button type="button" id="new">新規作成</button>
          <button type="button" id="print">印刷 / PDF保存</button>
          <button type="button" id="export-csv">CSV出力</button>
        </div>
        <p class="status" id="status"></p>
        <p class="note">PDF保存は、印刷画面で保存先に「PDFに保存」を選んでください。</p>
      </section>
      <section class="card">
        <h2>保存済みの請求書</h2>
        <ul class="saved" id="saved-list"></ul>
        <div class="actions">
          <button type="button" id="export-json">全データをJSONで書き出し</button>
          <button type="button" id="import-btn">JSONを読み込み</button>
          <input type="file" id="import-json" accept=".json,application/json" hidden />
        </div>
        <p class="note">ブラウザのデータを消去すると保存内容も消えます。定期的にJSONでバックアップしてください。</p>
      </section>
      <section class="card note">
        <h2>ご利用にあたって</h2>
        <p>本ツールは請求書作成の補助です。税務上の取り扱い・記載要件の最終確認は、国税庁の案内や税理士等の専門家にご確認ください。源泉徴収税額は一般的な報酬（10.21%／100万円超の部分20.42%）の目安計算で、全ての報酬に当てはまるわけではありません。</p>
      </section>
    </div>
    <div class="sheet-scroll"><div class="sheet" id="preview"></div></div>
  </div>
</div>`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
let store: StoreData = loadStore()
let currentId = newId()

function addItemRow(it: Item = { name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }): void {
  const row = el('div', { class: 'item' })
  const name = el('input', { 'aria-label': '品名', placeholder: '品名', 'data-f': 'name' })
  name.value = it.name
  const grid = el('div', { class: 'row3' })
  const mk = (label: string, f: string, v: string): HTMLInputElement => {
    const wrap = el('div')
    wrap.appendChild(el('label', {}, label))
    const i = el('input', { 'data-f': f, inputmode: 'decimal', autocomplete: 'off' })
    i.value = v
    wrap.appendChild(i)
    grid.appendChild(wrap)
    return i
  }
  mk('数量', 'quantity', String(it.quantity))
  mk('単価（円）', 'unit', String(it.unitPriceYen))
  const rw = el('div')
  rw.appendChild(el('label', {}, '税率'))
  const sel = el('select', { 'data-f': 'rate', 'aria-label': '税率' })
  for (const [v, t] of [['10', '10%'], ['8', '8%（軽減）'], ['0', '非課税・不課税']]) {
    const o = el('option', { value: v }, t)
    sel.appendChild(o)
  }
  sel.value = String(it.taxRate)
  rw.appendChild(sel)
  grid.appendChild(rw)
  const rm = el('button', { type: 'button', class: 'danger', 'data-f': 'remove' }, '削除')
  rm.addEventListener('click', () => { row.remove(); refresh() })
  const actions = el('div', { class: 'actions' })
  actions.appendChild(rm)
  row.append(name, grid, actions)
  $('items').appendChild(row)
}

function readInvoice(): Invoice {
  const items: Item[] = Array.from($('items').children).map((row) => {
    const g = (f: string) => (row.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value
    return { name: g('name'), quantity: parseNum(g('quantity')), unitPriceYen: parseNum(g('unit')), taxRate: Number(g('rate')) as TaxRate }
  })
  return {
    id: currentId,
    number: $<HTMLInputElement>('invNumber').value,
    clientName: $<HTMLInputElement>('clientName').value,
    issueDate: $<HTMLInputElement>('issueDate').value,
    dueDate: $<HTMLInputElement>('dueDate').value,
    subject: $<HTMLInputElement>('subject').value,
    items,
    priceMode: $<HTMLSelectElement>('priceMode').value as PriceMode,
    rounding: $<HTMLSelectElement>('rounding').value as Rounding,
    withholding: $<HTMLInputElement>('withholding').checked,
    notes: $<HTMLTextAreaElement>('notes').value,
    issuer: {
      name: $<HTMLInputElement>('issuerName').value,
      registrationNumber: toHalfWidth($<HTMLInputElement>('issuerReg').value).toUpperCase(),
      address: $<HTMLTextAreaElement>('issuerAddress').value,
      bank: $<HTMLTextAreaElement>('issuerBank').value,
    },
  }
}

function writeInvoice(inv: Invoice): void {
  currentId = inv.id
  $<HTMLInputElement>('invNumber').value = inv.number
  $<HTMLInputElement>('clientName').value = inv.clientName
  $<HTMLInputElement>('issueDate').value = inv.issueDate
  $<HTMLInputElement>('dueDate').value = inv.dueDate
  $<HTMLInputElement>('subject').value = inv.subject
  $<HTMLSelectElement>('priceMode').value = inv.priceMode
  $<HTMLSelectElement>('rounding').value = inv.rounding
  $<HTMLInputElement>('withholding').checked = inv.withholding
  $<HTMLTextAreaElement>('notes').value = inv.notes
  $<HTMLInputElement>('issuerName').value = inv.issuer.name
  $<HTMLInputElement>('issuerReg').value = inv.issuer.registrationNumber
  $<HTMLTextAreaElement>('issuerAddress').value = inv.issuer.address
  $<HTMLTextAreaElement>('issuerBank').value = inv.issuer.bank
  $('items').replaceChildren()
  const items = inv.items.length ? inv.items : [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 as TaxRate }]
  items.forEach((i) => addItemRow(i))
}

function newInvoice(): Invoice {
  return normalizeInvoice({ id: newId(), issueDate: todayIso(), issuer: store.issuer, items: [] })
}

function td(text: string, cls = ''): HTMLTableCellElement {
  const c = el('td', cls ? { class: cls } : {}, text)
  return c
}

function renderPreview(inv: Invoice, valid: boolean): void {
  const root = $('preview')
  root.replaceChildren()
  if (!valid) {
    root.appendChild(el('p', { class: 'placeholder' }, '入力内容を確認してください。エラーが解消するとここに請求書が表示されます。'))
    return
  }
  const t = computeInvoice(inv)
  root.appendChild(el('h2', {}, '請求書'))
  const head = el('div', { class: 'head' })
  const left = el('div')
  left.appendChild(el('div', { class: 'to' }, inv.clientName + ' 御中'))
  if (inv.subject) left.appendChild(el('p', {}, '件名: ' + inv.subject))
  left.appendChild(el('p', {}, '下記のとおりご請求申し上げます。'))
  const right = el('div')
  right.appendChild(el('p', { class: 'pre' }, `請求番号: ${inv.number}\n発行日: ${jpDate(inv.issueDate)}` + (inv.dueDate ? `\n支払期限: ${jpDate(inv.dueDate)}` : '')))
  right.appendChild(el('p', { class: 'pre' }, [inv.issuer.name, inv.issuer.registrationNumber ? '登録番号: ' + inv.issuer.registrationNumber : '', inv.issuer.address].filter(Boolean).join('\n')))
  head.append(left, right)
  root.appendChild(head)
  root.appendChild(el('div', { class: 'big' }, `ご請求金額 ${yen(t.payableYen)}（税込）`))

  const table = el('table')
  const hr = el('tr')
  for (const h of ['品名', '数量', '単価', '税率', '金額']) hr.appendChild(el('th', {}, h))
  table.appendChild(hr)
  for (const it of inv.items) {
    const r = el('tr')
    r.append(td((it.taxRate === 8 ? '※ ' : '') + it.name), td(String(it.quantity), 'num'), td(yen(it.unitPriceYen), 'num'), td(it.taxRate === 0 ? '非課税' : it.taxRate + '%', 'num'), td(yen(lineAmount(it, inv.rounding)), 'num'))
    table.appendChild(r)
  }
  root.appendChild(table)
  root.appendChild(el('p', { class: 'note' }, '※は軽減税率（8%）対象。金額は' + (inv.priceMode === 'inclusive' ? '税込' : '税抜') + '表示。'))

  const sum = el('table', { class: 'sum' })
  const add = (label: string, value: string): void => {
    const r = el('tr')
    r.append(el('th', {}, label), td(value, 'num'))
    sum.appendChild(r)
  }
  for (const g of t.groups) {
    const lab = g.rate === 0 ? '非課税・不課税' : g.rate + '%対象'
    add(`${lab} 税抜`, yen(g.netYen))
    if (g.rate !== 0) add(`${lab} 消費税`, yen(g.taxYen))
  }
  add('合計（税込）', yen(t.grossYen))
  if (inv.withholding) add('源泉徴収税額', '-' + yen(t.withholdingYen))
  add('ご請求金額', yen(t.payableYen))
  root.appendChild(sum)
  if (inv.issuer.bank) root.appendChild(el('p', { class: 'pre' }, '【お振込先】\n' + inv.issuer.bank))
  if (inv.notes) root.appendChild(el('p', { class: 'pre' }, '【備考】\n' + inv.notes))
}

function showMessages(res: { errors: string[]; warnings: string[] }): void {
  const box = $('errors')
  box.replaceChildren()
  if (res.errors.length) {
    const ul = el('ul', { class: 'msg-error', id: 'error-list' })
    res.errors.forEach((m) => ul.appendChild(el('li', {}, m)))
    box.appendChild(ul)
  }
  if (res.warnings.length) {
    const ul = el('ul', { class: 'msg-warn' })
    res.warnings.forEach((m) => ul.appendChild(el('li', {}, m)))
    box.appendChild(ul)
  }
}

function setStatus(msg: string): void {
  $('status').textContent = msg
}

function persistDraft(inv: Invoice): void {
  store.issuer = inv.issuer
  store.draft = inv
  saveStore(store)
}

function refresh(): void {
  const inv = readInvoice()
  const res = validateInvoice(inv)
  showMessages(res)
  renderPreview(inv, res.errors.length === 0)
  persistDraft(inv)
}

function renderSaved(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (store.invoices.length === 0) {
    ul.appendChild(el('li', {}, '保存済みの請求書はまだありません。'))
    return
  }
  for (const inv of [...store.invoices].reverse()) {
    const li = el('li')
    li.appendChild(el('span', {}, `${inv.number || '(番号なし)'} / ${inv.clientName || '(請求先なし)'} / ${inv.issueDate}`))
    const box = el('span')
    const open = el('button', { type: 'button', 'data-act': 'open' }, '開く')
    open.addEventListener('click', () => { writeInvoice(inv); refresh(); setStatus('読み込みました。') })
    const del = el('button', { type: 'button', class: 'danger', 'data-act': 'delete' }, '削除')
    del.addEventListener('click', () => {
      if (!confirm('この請求書を削除しますか？')) return
      store.invoices = store.invoices.filter((x) => x.id !== inv.id)
      saveStore(store)
      renderSaved()
    })
    box.append(open, ' ', del)
    li.appendChild(box)
    ul.appendChild(li)
  }
}

app.addEventListener('input', refresh)
app.addEventListener('change', refresh)
$('add-item').addEventListener('click', () => { addItemRow(); refresh() })

$('save').addEventListener('click', () => {
  const inv = readInvoice()
  const res = validateInvoice(inv)
  showMessages(res)
  if (res.errors.length) { setStatus('入力エラーがあるため保存できません。'); return }
  const idx = store.invoices.findIndex((x) => x.id === inv.id)
  if (idx >= 0) store.invoices[idx] = inv
  else store.invoices.push(inv)
  const ok = saveStore(store)
  renderSaved()
  setStatus(ok ? '保存しました。' : '保存に失敗しました（ブラウザの保存領域が使えない可能性があります。JSONで書き出してください）。')
})

$('new').addEventListener('click', () => { writeInvoice(newInvoice()); refresh(); setStatus('新しい請求書を作成しました（発行者情報は引き継がれます）。') })

$('print').addEventListener('click', () => {
  const res = validateInvoice(readInvoice())
  if (res.errors.length) { showMessages(res); setStatus('入力エラーを解消してから印刷してください。'); return }
  window.print()
})

$('export-csv').addEventListener('click', () => {
  const inv = readInvoice()
  const res = validateInvoice(inv)
  if (res.errors.length) { showMessages(res); setStatus('入力エラーを解消してからCSV出力してください。'); return }
  downloadBlob(new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' }), csvFileName(inv))
})

$('export-json').addEventListener('click', () => {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  downloadBlob(new Blob([serializeStore(store)], { type: 'application/json;charset=utf-8' }), `${safeFileStem('invoice-generator-backup')}-${stamp}.json`)
})

$('import-btn').addEventListener('click', () => $<HTMLInputElement>('import-json').click())
$('import-json').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const data = parseImport(await file.text())
    if (!confirm(`読み込むと現在の保存データを置き換えます（請求書${data.invoices.length}件）。よろしいですか？`)) return
    store = data
    saveStore(store)
    writeInvoice(store.draft ?? newInvoice())
    renderSaved()
    refresh()
    setStatus('読み込みました。')
  } catch (err) {
    setStatus('読み込みに失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
  }
})

writeInvoice(store.draft ?? newInvoice())
renderSaved()
refresh()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
