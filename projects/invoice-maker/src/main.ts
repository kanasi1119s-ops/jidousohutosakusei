import './style.css'
import { calcTotals, formatYen, isValidRegNo, normalizeRegNo, parseNumber, type Rounding, type TaxRate } from './calc'
import { itemsCsvBlob, safeFileName } from './csv'
import { defaultDoc, exportJson, importJson, loadDoc, saveDoc, todayIso, type Doc } from './storage'

type Attrs = Record<string, string | number | boolean | undefined>
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) el.append(c) // 文字列は textContent 相当（HTMLとして解釈されない）
  return el
}

let doc: Doc = loadDoc()
const root = document.getElementById('app')!
const preview = h('div', { id: 'preview', 'data-testid': 'preview' })
const itemsBox = h('div', { id: 'items' })
const warnBox = h('p', { class: 'hint warn no-print', id: 'warn', role: 'alert' })
const regHint = h('p', { class: 'hint', id: 'reg-hint' })
const statusMsg = h('p', { class: 'hint', id: 'status', role: 'status' })

function persist() {
  saveDoc(doc)
  renderPreview()
}

function field(label: string, value: string, onInput: (v: string) => void, opts: { id: string; type?: string; textarea?: boolean; hint?: Node }): HTMLElement {
  const input = opts.textarea
    ? h('textarea', { id: opts.id })
    : h('input', { id: opts.id, type: opts.type ?? 'text', autocomplete: 'off' })
  ;(input as HTMLInputElement).value = value
  input.addEventListener('input', () => onInput((input as HTMLInputElement).value))
  const l = h('label', { for: opts.id }, label)
  const wrap = h('div', {}, l, input)
  if (opts.hint) wrap.append(opts.hint)
  return wrap
}

function updateRegHint() {
  const v = doc.issuer.regNo
  if (!v.trim()) {
    regHint.textContent = '適格請求書発行事業者の登録番号（T+数字13桁）。未登録の場合は空欄のままにしてください。'
    regHint.className = 'hint'
  } else if (isValidRegNo(v)) {
    regHint.textContent = '形式OK（番号の実在確認は国税庁の公表サイトで行ってください）'
    regHint.className = 'hint'
  } else {
    regHint.textContent = '形式が正しくありません（例: T1234567890123）'
    regHint.className = 'hint warn'
  }
}

function renderItems() {
  itemsBox.replaceChildren()
  doc.items.forEach((it, i) => {
    const name = h('input', { type: 'text', 'aria-label': `品名 ${i + 1}`, 'data-testid': 'item-name' })
    name.value = it.name
    name.addEventListener('input', () => { it.name = name.value; persist() })
    const qty = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `数量 ${i + 1}`, 'data-testid': 'item-qty' })
    qty.value = it.qty
    qty.addEventListener('input', () => { it.qty = qty.value; persist() })
    const price = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `単価(税抜) ${i + 1}`, 'data-testid': 'item-price' })
    price.value = it.unitPrice
    price.addEventListener('input', () => { it.unitPrice = price.value; persist() })
    const rate = h('select', { 'aria-label': `税率 ${i + 1}`, 'data-testid': 'item-rate' },
      h('option', { value: '10' }, '10%'),
      h('option', { value: '8' }, '8%（軽減税率）'),
      h('option', { value: '0' }, '非課税・不課税'))
    rate.value = String(it.rate)
    rate.addEventListener('change', () => { it.rate = Number(rate.value) as TaxRate; persist() })
    const del = h('button', { type: 'button', class: 'danger', 'data-testid': 'item-delete' }, '削除')
    del.addEventListener('click', () => {
      doc.items.splice(i, 1)
      if (doc.items.length === 0) doc.items.push({ name: '', qty: '1', unitPrice: '', rate: 10 })
      renderItems(); persist()
    })
    itemsBox.append(
      h('div', { class: 'item' },
        h('div', { class: 'item-head' }, `明細 ${i + 1}`, del),
        h('label', {}, '品名'), name,
        h('div', { class: 'row3' },
          h('div', {}, h('label', {}, '数量'), qty),
          h('div', {}, h('label', {}, '単価(税抜・円)'), price),
          h('div', {}, h('label', {}, '税率'), rate))),
    )
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function say(msg: string) { statusMsg.textContent = msg }

function buildEditor(): HTMLElement {
  const i = doc.issuer
  const issuerCard = h('section', { class: 'card' },
    h('h2', {}, '発行者（あなた）の情報'),
    field('氏名または名称', i.name, (v) => { i.name = v; persist() }, { id: 'issuer-name' }),
    field('登録番号（T+13桁）', i.regNo, (v) => { i.regNo = v; updateRegHint(); persist() }, { id: 'issuer-regno', hint: regHint }),
    field('住所', i.address, (v) => { i.address = v; persist() }, { id: 'issuer-address', textarea: true }),
    h('div', { class: 'row' },
      field('電話番号', i.tel, (v) => { i.tel = v; persist() }, { id: 'issuer-tel' }),
      field('メール', i.email, (v) => { i.email = v; persist() }, { id: 'issuer-email' })),
    field('振込先', i.bank, (v) => { i.bank = v; persist() }, { id: 'issuer-bank', textarea: true }),
  )
  const roundSel = h('select', { id: 'rounding' },
    h('option', { value: 'floor' }, '切り捨て'),
    h('option', { value: 'round' }, '四捨五入'),
    h('option', { value: 'ceil' }, '切り上げ'))
  roundSel.value = doc.rounding
  roundSel.addEventListener('change', () => { doc.rounding = roundSel.value as Rounding; persist() })
  const wh = h('input', { type: 'checkbox', id: 'withholding' })
  wh.checked = doc.withholding
  wh.addEventListener('change', () => { doc.withholding = wh.checked; persist() })
  const docCard = h('section', { class: 'card' },
    h('h2', {}, '請求内容'),
    h('div', { class: 'row' },
      field('請求先名', doc.clientName, (v) => { doc.clientName = v; persist() }, { id: 'client-name' }),
      field('敬称', doc.honorific, (v) => { doc.honorific = v; persist() }, { id: 'honorific' })),
    h('div', { class: 'row' },
      field('請求書番号', doc.invoiceNo, (v) => { doc.invoiceNo = v; persist() }, { id: 'invoice-no' }),
      field('発行日（取引年月日）', doc.issueDate, (v) => { doc.issueDate = v; persist() }, { id: 'issue-date', type: 'date' })),
    field('支払期限', doc.dueDate, (v) => { doc.dueDate = v; persist() }, { id: 'due-date', type: 'date' }),
    h('label', { for: 'rounding' }, '消費税の端数処理（税率ごとに1回）'), roundSel,
    h('label', {}, wh, ' 源泉徴収税を差し引く（報酬・料金等の場合。税抜金額を基準に計算）'),
    field('備考', doc.notes, (v) => { doc.notes = v; persist() }, { id: 'notes', textarea: true }),
  )
  const addBtn = h('button', { type: 'button', class: 'secondary', id: 'add-item' }, '＋ 明細を追加')
  addBtn.addEventListener('click', () => {
    doc.items.push({ name: '', qty: '1', unitPrice: '', rate: 10 })
    renderItems(); persist()
  })
  const itemsCard = h('section', { class: 'card' }, h('h2', {}, '明細'), itemsBox, h('div', { class: 'actions' }, addBtn))

  const printBtn = h('button', { type: 'button', id: 'print' }, '印刷 / PDFとして保存')
  printBtn.addEventListener('click', () => window.print())
  const csvBtn = h('button', { type: 'button', class: 'secondary', id: 'export-csv' }, 'CSV出力（Excel対応）')
  csvBtn.addEventListener('click', () => download(itemsCsvBlob(doc), safeFileName(doc.invoiceNo, 'csv', todayIso())))
  const jsonBtn = h('button', { type: 'button', class: 'secondary', id: 'export-json' }, 'バックアップ(JSON)')
  jsonBtn.addEventListener('click', () => {
    download(new Blob([exportJson(doc)], { type: 'application/json;charset=utf-8' }), safeFileName(doc.invoiceNo, 'json', todayIso()))
    say('バックアップを書き出しました。')
  })
  const file = h('input', { type: 'file', accept: '.json,application/json', id: 'import-file', 'aria-label': 'JSONを読み込む' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) return
    const d = f.size > 2_000_000 ? null : importJson(await f.text())
    if (!d) { say('読み込めませんでした。本サイトで書き出したJSONファイルを選んでください。'); return }
    doc = d
    rebuild(); persist(); say('読み込みました。')
  })
  const newBtn = h('button', { type: 'button', class: 'danger', id: 'reset' }, '新しい請求書にする')
  newBtn.addEventListener('click', () => {
    if (!confirm('現在の入力内容を消して新しい請求書にします。よろしいですか？（発行者情報は引き継ぎます）')) return
    const keep = doc.issuer
    doc = defaultDoc(); doc.issuer = keep
    rebuild(); persist()
  })
  const outCard = h('section', { class: 'card' },
    h('h2', {}, '出力・保存'),
    h('div', { class: 'actions' }, printBtn, csvBtn, jsonBtn),
    h('label', { for: 'import-file' }, 'バックアップから復元'), file,
    h('div', { class: 'actions' }, newBtn),
    statusMsg,
    h('p', { class: 'disclaimer' },
      '本ツールは請求書作成の補助を目的とし、税務・法律上の助言ではありません。適格請求書の記載要件・税率・源泉徴収の取り扱いは国税庁の公表情報で最新内容を確認し、不明点は税理士等にご相談ください。' +
      '※消費税率・端数処理・源泉徴収率は2026年11月時点の一般的な取り扱いに基づく簡易計算です。'),
  )
  return h('div', { id: 'editor' }, issuerCard, docCard, itemsCard, outCard)
}

function td(text: string, cls = ''): HTMLElement { return h('td', cls ? { class: cls } : {}, text) }

function renderPreview() {
  const t = calcTotals(doc.items, doc.rounding, doc.withholding)
  const reg = normalizeRegNo(doc.issuer.regNo)
  const rows = doc.items
    .map((it, i) => ({ it, amt: t.lines[i] }))
    .filter(({ it }) => it.name.trim() !== '' || parseNumber(it.unitPrice) !== null)
    .map(({ it, amt }) => h('tr', {},
      td(it.name + (it.rate === 8 ? ' ※' : '')),
      td(String(parseNumber(it.qty) ?? ''), 'num'),
      td(parseNumber(it.unitPrice) === null ? '' : formatYen(parseNumber(it.unitPrice)!), 'num'),
      td(it.rate === 0 ? '非課税' : `${it.rate}%`, 'num'),
      td(formatYen(amt), 'num')))
  const totalsRows: HTMLElement[] = []
  for (const r of t.byRate) {
    totalsRows.push(h('tr', {}, h('th', {}, `${r.rate === 0 ? '非課税' : r.rate + '%'}対象（税抜）`), td(formatYen(r.subtotal), 'num')))
    if (r.rate !== 0) totalsRows.push(h('tr', {}, h('th', {}, `${r.rate}%消費税`), td(formatYen(r.tax), 'num')))
  }
  totalsRows.push(h('tr', {}, h('th', {}, '合計（税込）'), td(formatYen(t.total), 'num')))
  if (doc.withholding) {
    totalsRows.push(h('tr', {}, h('th', {}, '源泉徴収税額'), td('-' + formatYen(t.withholding), 'num')))
    totalsRows.push(h('tr', {}, h('th', {}, '差引請求額'), td(formatYen(t.payable), 'num')))
  }
  const hasReduced = doc.items.some((x) => x.rate === 8)
  warnBox.textContent = t.invalid.length > 0
    ? `⚠ 明細 ${t.invalid.map((i) => i + 1).join(', ')} の数量・単価が不正または範囲外（数量は±100万、単価は±10億まで）のため、0円として計算しています。`
    : ''
  preview.replaceChildren(
    h('h2', {}, '請求書'),
    h('div', { class: 'meta' },
      h('div', {},
        h('div', { class: 'client' }, `${doc.clientName || '（請求先）'} ${doc.honorific}`),
        h('div', {}, '下記のとおりご請求申し上げます。'),
        h('div', { class: 'big', 'data-testid': 'grand-total' }, `ご請求金額 ${formatYen(doc.withholding ? t.payable : t.total)}`),
        h('div', {}, doc.dueDate ? `お支払期限: ${doc.dueDate}` : '')),
      h('div', {},
        h('div', {}, `請求書番号: ${doc.invoiceNo}`),
        h('div', {}, `発行日（取引年月日）: ${doc.issueDate}`),
        h('div', {}, h('strong', {}, doc.issuer.name || '（発行者名）')),
        reg ? h('div', {}, `登録番号: ${reg}`) : h('div', {}),
        h('div', { class: 'pre' }, doc.issuer.address),
        h('div', {}, [doc.issuer.tel, doc.issuer.email].filter(Boolean).join(' / ')))),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', {}, '数量'), h('th', {}, '単価(税抜)'), h('th', {}, '税率'), h('th', {}, '金額(税抜)'))), h('tbody', {}, ...rows)),
    hasReduced ? h('div', {}, '※は軽減税率（8%）対象') : h('div', {}),
    h('table', { class: 'totals' }, h('tbody', {}, ...totalsRows)),
    doc.issuer.bank ? h('div', { class: 'pre' }, '【振込先】\n' + doc.issuer.bank) : h('div', {}),
    doc.notes ? h('div', { class: 'pre' }, '【備考】\n' + doc.notes) : h('div', {}),
  )
}

function rebuild() {
  root.replaceChildren(
    h('header', { class: 'site' },
      h('h1', {}, '請求書メーカー'),
      h('p', {}, 'インボイス（適格請求書）の記載事項に沿った請求書を、登録不要・オフラインでも作成できます')),
    h('main', {},
      h('div', {},
        h('p', { class: 'privacy' }, '🔒 入力内容はこの端末のブラウザ内にのみ保存され、外部へ送信されません。ブラウザのデータを消すと失われるため、こまめに「バックアップ(JSON)」を保存してください。'),
        buildEditor()),
      h('section', { class: 'card', 'aria-label': 'プレビュー' }, h('h2', { class: 'no-print' }, 'プレビュー（印刷されるのはこの部分です）'), warnBox, preview)),
  )
  renderItems()
  updateRegHint()
  renderPreview()
}

rebuild()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
