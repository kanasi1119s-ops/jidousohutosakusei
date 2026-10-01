import './style.css'
import {
  MAX_ITEMS,
  calcTotals,
  formatDateJa,
  formatYen,
  isValidRegistrationNumber,
  newInvoice,
  newItem,
  normalizeNumber,
  normalizeRegistrationNumber,
  type Honorific,
  type Invoice,
  type PriceMode,
  type Rounding,
  type TaxRate,
} from './calc'
import { buildInvoiceCsvBlob, csvFileName } from './csv'
import {
  exportFileName,
  invoicesToJsonBlob,
  loadState,
  parseImport,
  saveState,
  upsertSaved,
  type AppState,
} from './storage'

const loaded = loadState()
const state: AppState = loaded ?? { current: newInvoice(), saved: [] }

const app = document.getElementById('app')!
app.innerHTML = `
<header class="site-header no-print">
  <h1>インボイス請求書ジェネレーター</h1>
  <p class="lead">登録不要・オフライン対応。入力した内容はこのブラウザの中だけに保存され、外部へ送信されません。</p>
</header>
<main class="layout">
  <section class="panel no-print" aria-label="入力フォーム">
    <fieldset>
      <legend>発行者（あなた）</legend>
      <label>氏名・会社名<input id="issuer-name" type="text" autocomplete="off" /></label>
      <label>住所<textarea id="issuer-address" rows="2"></textarea></label>
      <label>適格請求書発行事業者の登録番号（T＋数字13桁）
        <input id="issuer-reg" type="text" placeholder="T1234567890123" autocomplete="off" />
      </label>
      <p id="reg-hint" class="hint" role="status"></p>
    </fieldset>
    <fieldset>
      <legend>請求先</legend>
      <div class="row">
        <label class="grow">請求先名<input id="client-name" type="text" autocomplete="off" /></label>
        <label>敬称
          <select id="client-honorific">
            <option value="御中">御中</option>
            <option value="様">様</option>
            <option value="">なし</option>
          </select>
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>請求書情報</legend>
      <div class="row">
        <label class="grow">請求書番号<input id="inv-number" type="text" autocomplete="off" /></label>
        <label>発行日<input id="issue-date" type="date" /></label>
        <label>支払期限<input id="due-date" type="date" /></label>
      </div>
      <div class="row">
        <label>金額の入力方式
          <select id="price-mode">
            <option value="exclusive">税抜入力（税を加算）</option>
            <option value="inclusive">税込入力（内税）</option>
          </select>
        </label>
        <label>端数処理
          <select id="rounding">
            <option value="floor">切り捨て</option>
            <option value="round">四捨五入</option>
            <option value="ceil">切り上げ</option>
          </select>
        </label>
      </div>
      <p class="hint">消費税額は「1枚の請求書あたり税率ごとに1回」だけ端数処理します（行ごとには処理しません）。</p>
    </fieldset>
    <fieldset>
      <legend>明細</legend>
      <div id="items" class="items"></div>
      <button type="button" id="add-item" class="secondary">＋ 行を追加</button>
      <p class="hint">数量・単価は全角数字やカンマ入力もOKです。値引きはマイナスの単価で入力できます。</p>
    </fieldset>
    <fieldset>
      <legend>備考・振込先</legend>
      <label>振込先<textarea id="bank" rows="2"></textarea></label>
      <label>備考<textarea id="notes" rows="2"></textarea></label>
    </fieldset>
    <fieldset>
      <legend>操作</legend>
      <div class="actions">
        <button type="button" id="print-btn" class="primary">印刷 / PDFとして保存</button>
        <button type="button" id="save-btn">この請求書を保存</button>
        <button type="button" id="new-btn">新しい請求書</button>
      </div>
      <div class="actions">
        <button type="button" id="export-csv">明細をCSVでダウンロード</button>
        <button type="button" id="export-json">全データをJSONでバックアップ</button>
        <label class="file-btn">JSONを読み込む<input id="import-json" type="file" accept="application/json,.json" /></label>
      </div>
      <p id="message" class="message" role="status"></p>
      <h2 class="small-h">保存済みの請求書</h2>
      <ul id="saved-list" class="saved-list"></ul>
    </fieldset>
    <p class="disclaimer">
      本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。適格請求書の要件や税額計算は
      <a href="https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm" target="_blank" rel="noopener noreferrer">国税庁のインボイス制度の解説</a>
      で最新の情報をご確認ください。
    </p>
  </section>
  <section class="preview-wrap" aria-label="プレビュー">
    <p id="pv-reg-warning" class="warning no-print" role="alert"></p>
    <article id="preview" class="sheet"></article>
  </section>
</main>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

function persist(): void {
  state.current.updatedAt = Date.now()
  saveState(state)
}

function say(msg: string, isError = false): void {
  const el = $('message')
  el.textContent = msg
  el.classList.toggle('error', isError)
}

// ---- フォーム <-> 状態 -------------------------------------------------

function writeForm(): void {
  const inv = state.current
  $<HTMLInputElement>('issuer-name').value = inv.issuer.name
  $<HTMLTextAreaElement>('issuer-address').value = inv.issuer.address
  $<HTMLInputElement>('issuer-reg').value = inv.issuer.registrationNumber
  $<HTMLInputElement>('client-name').value = inv.clientName
  $<HTMLSelectElement>('client-honorific').value = inv.honorific
  $<HTMLInputElement>('inv-number').value = inv.number
  $<HTMLInputElement>('issue-date').value = inv.issueDate
  $<HTMLInputElement>('due-date').value = inv.dueDate
  $<HTMLSelectElement>('price-mode').value = inv.priceMode
  $<HTMLSelectElement>('rounding').value = inv.rounding
  $<HTMLTextAreaElement>('bank').value = inv.bank
  $<HTMLTextAreaElement>('notes').value = inv.notes
  renderItemRows()
}

function readForm(): void {
  const inv = state.current
  inv.issuer.name = $<HTMLInputElement>('issuer-name').value
  inv.issuer.address = $<HTMLTextAreaElement>('issuer-address').value
  inv.issuer.registrationNumber = $<HTMLInputElement>('issuer-reg').value
  inv.clientName = $<HTMLInputElement>('client-name').value
  inv.honorific = $<HTMLSelectElement>('client-honorific').value as Honorific
  inv.number = $<HTMLInputElement>('inv-number').value
  inv.issueDate = $<HTMLInputElement>('issue-date').value
  inv.dueDate = $<HTMLInputElement>('due-date').value
  inv.priceMode = $<HTMLSelectElement>('price-mode').value as PriceMode
  inv.rounding = $<HTMLSelectElement>('rounding').value as Rounding
  inv.bank = $<HTMLTextAreaElement>('bank').value
  inv.notes = $<HTMLTextAreaElement>('notes').value
  const rows = Array.from(document.querySelectorAll<HTMLElement>('#items .item-row'))
  inv.items = rows.map((row) => ({
    name: row.querySelector<HTMLInputElement>('.item-name')!.value,
    quantity: normalizeNumber(row.querySelector<HTMLInputElement>('.item-qty')!.value),
    unitPrice: normalizeNumber(row.querySelector<HTMLInputElement>('.item-price')!.value),
    taxRate: Number(row.querySelector<HTMLSelectElement>('.item-rate')!.value) as TaxRate,
  }))
}

function renderItemRows(): void {
  const box = $('items')
  box.replaceChildren()
  state.current.items.forEach((it, i) => {
    const rate = h('select', { class: 'item-rate', 'aria-label': `税率（${i + 1}行目）` })
    for (const [v, label] of [['10', '10%'], ['8', '8%（軽減）'], ['0', '非課税']] as const) {
      const o = h('option', { value: v }, label)
      rate.append(o)
    }
    rate.value = String(it.taxRate)
    const name = h('input', { class: 'item-name', type: 'text', placeholder: '品名', 'aria-label': `品名（${i + 1}行目）` })
    name.value = it.name
    const qty = h('input', { class: 'item-qty', type: 'text', inputmode: 'decimal', 'aria-label': `数量（${i + 1}行目）` })
    qty.value = String(it.quantity)
    const price = h('input', { class: 'item-price', type: 'text', inputmode: 'decimal', 'aria-label': `単価（${i + 1}行目）` })
    price.value = String(it.unitPrice)
    const amount = h('span', { class: 'item-amount' })
    const del = h('button', { type: 'button', class: 'item-del secondary', 'aria-label': `${i + 1}行目を削除` }, '削除')
    del.addEventListener('click', () => {
      readForm()
      state.current.items.splice(i, 1)
      if (state.current.items.length === 0) state.current.items.push(newItem())
      renderItemRows()
      update()
    })
    box.append(
      h('div', { class: 'item-row' },
        h('label', { class: 'item-cell name' }, '品名', name),
        h('label', { class: 'item-cell' }, '数量', qty),
        h('label', { class: 'item-cell' }, '単価(円)', price),
        h('label', { class: 'item-cell' }, '税率', rate),
        h('div', { class: 'item-cell' }, '金額', amount),
        del),
    )
  })
}

// ---- プレビュー --------------------------------------------------------

function renderPreview(): void {
  const inv = state.current
  const totals = calcTotals(inv.items, inv.priceMode, inv.rounding)
  const regOk = isValidRegistrationNumber(inv.issuer.registrationNumber)
  const reg = normalizeRegistrationNumber(inv.issuer.registrationNumber)

  const amountCells = document.querySelectorAll<HTMLElement>('#items .item-amount')
  amountCells.forEach((el, i) => {
    el.textContent = totals.lineAmounts[i] === undefined ? '' : formatYen(totals.lineAmounts[i])
  })

  const clientLine = inv.clientName ? `${inv.clientName} ${inv.honorific}`.trim() : '（請求先未入力）'
  const hasReduced = inv.items.some((it) => it.taxRate === 8)

  const rows = inv.items.map((it, i) =>
    h('tr', {},
      h('td', { class: 'pv-name' }, (it.taxRate === 8 ? '※ ' : '') + it.name),
      h('td', { class: 'num' }, String(it.quantity)),
      h('td', { class: 'num' }, formatYen(it.unitPrice)),
      h('td', { class: 'num' }, it.taxRate === 0 ? '非課税' : `${it.taxRate}%`),
      h('td', { class: 'num' }, formatYen(totals.lineAmounts[i])),
    ),
  )
  const amountHead = inv.priceMode === 'inclusive' ? '金額（税込）' : '金額（税抜）'

  const groupRows = totals.groups.map((g) =>
    h('tr', {},
      h('th', { scope: 'row' }, g.rate === 0 ? '非課税対象' : g.rate === 8 ? '8%対象（軽減税率）' : '10%対象'),
      h('td', { class: 'num' }, formatYen(g.base)),
      h('td', { class: 'num' }, g.rate === 0 ? '-' : formatYen(g.tax)),
      h('td', { class: 'num' }, formatYen(g.total)),
    ),
  )

  const root = $('preview')
  root.replaceChildren(
    h('h2', { class: 'pv-title' }, '請求書'),
    h('div', { class: 'pv-meta' },
      h('div', { class: 'pv-client' }, h('p', { class: 'pv-client-name' }, clientLine)),
      h('dl', {},
        h('dt', {}, '請求書番号'), h('dd', {}, inv.number || '-'),
        h('dt', {}, '発行日'), h('dd', {}, formatDateJa(inv.issueDate) || '-'),
        h('dt', {}, '支払期限'), h('dd', {}, formatDateJa(inv.dueDate) || '-'),
      ),
    ),
    h('div', { class: 'pv-issuer' },
      h('p', { class: 'pv-issuer-name' }, inv.issuer.name || '（発行者未入力）'),
      h('p', { class: 'pre' }, inv.issuer.address),
      h('p', {}, reg ? `登録番号: ${reg}` : ''),
    ),
    h('p', { class: 'pv-total-line' }, 'ご請求金額（税込） ', h('strong', { id: 'pv-total' }, formatYen(totals.total))),
    h('table', { class: 'pv-items' },
      h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', {}, '数量'), h('th', {}, '単価'), h('th', {}, '税率'), h('th', {}, amountHead))),
      h('tbody', {}, ...rows),
    ),
    hasReduced ? h('p', { class: 'pv-note' }, '※は軽減税率（8%）対象です。') : h('span'),
    h('table', { class: 'pv-groups' },
      h('thead', {}, h('tr', {}, h('th', {}, '税率区分'), h('th', {}, '税抜金額'), h('th', {}, '消費税額'), h('th', {}, '税込金額'))),
      h('tbody', {}, ...groupRows),
      h('tfoot', {}, h('tr', {},
        h('th', { scope: 'row' }, '合計'),
        h('td', { class: 'num' }, formatYen(totals.subtotal)),
        h('td', { class: 'num' }, formatYen(totals.tax)),
        h('td', { class: 'num' }, formatYen(totals.total)),
      )),
    ),
    inv.bank ? h('div', { class: 'pv-block' }, h('h3', {}, '振込先'), h('p', { class: 'pre' }, inv.bank)) : h('span'),
    inv.notes ? h('div', { class: 'pv-block' }, h('h3', {}, '備考'), h('p', { class: 'pre' }, inv.notes)) : h('span'),
  )

  $('pv-reg-warning').textContent = regOk
    ? ''
    : '登録番号が未入力、または「T＋数字13桁」の形式ではありません。このままでは適格請求書の記載事項を満たしません。'
  $('reg-hint').textContent = !inv.issuer.registrationNumber
    ? ''
    : regOk
      ? `形式OK: ${reg}（国税庁の公表サイトで登録の有無は別途ご確認ください）`
      : '形式が正しくありません（T＋数字13桁）'
}

function renderSavedList(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (state.saved.length === 0) {
    ul.append(h('li', { class: 'empty' }, 'まだ保存された請求書はありません。'))
    return
  }
  for (const inv of state.saved) {
    const total = calcTotals(inv.items, inv.priceMode, inv.rounding).total
    const label = `${inv.number || '(番号なし)'} / ${inv.clientName || '(請求先なし)'} / ${formatYen(total)}`
    const open = h('button', { type: 'button', class: 'saved-open' }, label)
    open.addEventListener('click', () => {
      state.current = JSON.parse(JSON.stringify(inv)) as Invoice
      writeForm()
      update()
      say('保存済みの請求書を読み込みました。')
    })
    const del = h('button', { type: 'button', class: 'saved-del secondary', 'aria-label': `${label} を削除` }, '削除')
    del.addEventListener('click', () => {
      state.saved = state.saved.filter((s) => s.id !== inv.id)
      persist()
      renderSavedList()
    })
    ul.append(h('li', {}, open, del))
  }
}

function update(): void {
  readForm()
  renderPreview()
  persist()
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- イベント ----------------------------------------------------------

document.querySelector('.panel')!.addEventListener('input', update)
document.querySelector('.panel')!.addEventListener('change', (e) => {
  if ((e.target as HTMLElement).id !== 'import-json') update()
})

$('add-item').addEventListener('click', () => {
  readForm()
  if (state.current.items.length >= MAX_ITEMS) {
    say(`明細は${MAX_ITEMS}行までです。`, true)
    return
  }
  state.current.items.push(newItem())
  renderItemRows()
  update()
})

$('print-btn').addEventListener('click', () => {
  update()
  window.print()
})

$('save-btn').addEventListener('click', () => {
  update()
  state.saved = upsertSaved(state.saved, state.current)
  persist()
  renderSavedList()
  say('この請求書を保存しました（このブラウザ内のみ）。')
})

$('new-btn').addEventListener('click', () => {
  readForm()
  state.current = newInvoice(state.current.issuer)
  writeForm()
  update()
  say('新しい請求書を作成しました（発行者情報は引き継いでいます）。')
})

$('export-csv').addEventListener('click', () => {
  update()
  download(buildInvoiceCsvBlob(state.current), csvFileName(state.current))
})

$('export-json').addEventListener('click', () => {
  update()
  const all = upsertSaved(state.saved, state.current)
  download(invoicesToJsonBlob(all), exportFileName())
})

$<HTMLInputElement>('import-json').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 5_000_000) throw new Error('ファイルが大きすぎます（5MBまで）。')
    const invoices = parseImport(await file.text())
    for (const inv of invoices) state.saved = upsertSaved(state.saved, inv)
    state.current = JSON.parse(JSON.stringify(invoices[0])) as Invoice
    writeForm()
    update()
    renderSavedList()
    say(`${invoices.length}件の請求書を読み込みました。`)
  } catch (err) {
    say(err instanceof Error ? err.message : '読み込みに失敗しました。', true)
  } finally {
    input.value = ''
  }
})

writeForm()
renderSavedList()
renderPreview()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
