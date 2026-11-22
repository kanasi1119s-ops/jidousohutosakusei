import './style.css'
import {
  computeInvoice,
  formatYen,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumberInput,
  type LineInput,
  type PriceMode,
  type Rounding,
  type TaxRate,
} from './calc'
import { buildInvoicesCsv, csvBlob, csvFileName, jsonFileName } from './csv'
import { newInvoice, parseAppData, type AppData, type Invoice } from './model'
import { loadData, saveData } from './storage'

type Attrs = Record<string, string | boolean | number | undefined>

// ユーザー入力を innerHTML に入れないため、DOMは必ずこの関数（textContent）で組み立てる
function h(tag: string, attrs: Attrs = {}, children: (Node | string)[] = []): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, String(v))
  }
  for (const c of children) el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  return el
}

let data: AppData = loadData()
let current: Invoice = newInvoice(data.nextSeq)
const invalidFields = new Set<string>()

const app = document.getElementById('app') as HTMLElement

function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  const id = input.id
  return h('div', { class: 'field' }, [
    h('label', { for: id }, [label]),
    input,
    ...(hint ? [h('small', {}, [hint])] : []),
  ])
}

function textInput(id: string, value: string, onInput: (v: string) => void, extra: Attrs = {}) {
  const el = h('input', { id, type: 'text', autocomplete: 'off', ...extra }) as HTMLInputElement
  el.value = value
  el.addEventListener('input', () => onInput(el.value))
  return el
}

function textArea(id: string, value: string, onInput: (v: string) => void, rows = 3) {
  const el = h('textarea', { id, rows }) as HTMLTextAreaElement
  el.value = value
  el.addEventListener('input', () => onInput(el.value))
  return el
}

function select(id: string, value: string, options: [string, string][], onChange: (v: string) => void) {
  const el = h(
    'select',
    { id },
    options.map(([v, l]) => h('option', { value: v }, [l])),
  ) as HTMLSelectElement
  el.value = value
  el.addEventListener('change', () => onChange(el.value))
  return el
}

// ---------- 画面骨格 ----------
const message = h('p', { id: 'message', role: 'status', class: 'message' })
const warnings = h('ul', { id: 'warnings', class: 'warnings' })
const sheet = h('section', { id: 'sheet', class: 'sheet', 'aria-label': '請求書プレビュー' })
const linesBody = h('tbody', { id: 'lines-body' })
const savedList = h('ul', { id: 'saved-list', class: 'saved-list' })

function flash(text: string) {
  message.textContent = text
}

function persist() {
  if (!saveData(data)) flash('このブラウザでは保存領域が使えないため、データは保存されません。バックアップ(JSON)を書き出してください。')
}

// ---------- 発行者・請求書の入力欄 ----------
function buildIssuerSection(): HTMLElement {
  const i = data.issuer
  return h('section', { class: 'card no-print' }, [
    h('h2', {}, ['発行者（あなた）の情報']),
    h('p', { class: 'note' }, ['この情報はこのブラウザ内にだけ保存され、次回から自動で入力されます。']),
    field('氏名または名称', textInput('issuer-name', i.name, (v) => { data.issuer.name = v; persist(); update() })),
    field(
      '適格請求書発行事業者の登録番号',
      textInput('issuer-reg', i.registrationNumber, (v) => { data.issuer.registrationNumber = v; persist(); update() }, { placeholder: 'T1234567890123', inputmode: 'text' }),
      'T + 数字13桁。登録していない場合は空欄のまま発行できます。',
    ),
    field('住所', textArea('issuer-address', i.address, (v) => { data.issuer.address = v; persist(); update() }, 2)),
    field('連絡先（任意）', textInput('issuer-contact', i.contact, (v) => { data.issuer.contact = v; persist(); update() })),
    field('振込先（任意）', textArea('issuer-bank', i.bank, (v) => { data.issuer.bank = v; persist(); update() }, 2)),
  ])
}

function buildInvoiceSection(): HTMLElement {
  const c = current
  const dateInput = (id: string, value: string, on: (v: string) => void) =>
    textInput(id, value, on, { type: 'date' })
  return h('section', { class: 'card no-print' }, [
    h('h2', {}, ['請求書の内容']),
    h('div', { class: 'grid2' }, [
      field('請求書番号', textInput('inv-number', c.number, (v) => { current.number = v; update() })),
      field('発行日', dateInput('inv-issue', c.issueDate, (v) => { current.issueDate = v; update() })),
      field('支払期限（任意）', dateInput('inv-due', c.dueDate, (v) => { current.dueDate = v; update() })),
      field('請求先（取引先名）', textInput('inv-client', c.clientName, (v) => { current.clientName = v; update() })),
    ]),
    field('件名（任意）', textInput('inv-subject', c.subject, (v) => { current.subject = v; update() })),
    h('div', { class: 'grid2' }, [
      field(
        '単価の入力方式',
        select('inv-mode', c.priceMode, [['exclusive', '税抜価格で入力'], ['inclusive', '税込価格で入力']], (v) => { current.priceMode = v as PriceMode; update() }),
      ),
      field(
        '端数処理',
        select('inv-rounding', c.rounding, [['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']], (v) => { current.rounding = v as Rounding; update() }),
        '消費税額は税率ごとに1回だけ処理します。',
      ),
    ]),
    h('div', { class: 'field check' }, [
      (() => {
        const cb = h('input', { id: 'inv-withholding', type: 'checkbox' }) as HTMLInputElement
        cb.checked = c.withholding
        cb.addEventListener('change', () => { current.withholding = cb.checked; update() })
        return cb
      })(),
      h('label', { for: 'inv-withholding' }, ['源泉徴収税額を差し引く（報酬・料金等 10.21%／100万円超の部分は20.42%）']),
    ]),
    h('h3', {}, ['明細']),
    h('div', { class: 'table-wrap' }, [
      h('table', { class: 'lines' }, [
        h('thead', {}, [
          h('tr', {}, ['品名', '数量', '単価(円)', '税率', ''].map((t) => h('th', {}, [t]))),
        ]),
        linesBody,
      ]),
    ]),
    h('button', { type: 'button', id: 'add-line', class: 'secondary' }, ['＋ 明細行を追加']),
    field('備考（任意）', textArea('inv-note', c.note, (v) => { current.note = v; update() }, 3)),
  ])
}

function numberCell(rowIdx: number, key: 'qty' | 'unitPrice', value: number): HTMLElement {
  const id = `line-${rowIdx}-${key}`
  const el = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': key === 'qty' ? `明細${rowIdx + 1}の数量` : `明細${rowIdx + 1}の単価` }) as HTMLInputElement
  el.value = String(value)
  el.addEventListener('input', () => {
    const n = parseNumberInput(el.value)
    if (Number.isNaN(n) || (key === 'qty' && n < 0)) {
      invalidFields.add(id)
      el.classList.add('invalid')
      current.lines[rowIdx][key] = 0
    } else {
      invalidFields.delete(id)
      el.classList.remove('invalid')
      current.lines[rowIdx][key] = n
    }
    update()
  })
  return h('td', {}, [el])
}

function renderLines() {
  invalidFields.clear()
  linesBody.replaceChildren()
  current.lines.forEach((line, idx) => {
    const name = h('input', { id: `line-${idx}-name`, type: 'text', autocomplete: 'off', 'aria-label': `明細${idx + 1}の品名` }) as HTMLInputElement
    name.value = line.name
    name.addEventListener('input', () => { current.lines[idx].name = name.value; update() })
    const rate = h('select', { id: `line-${idx}-rate`, 'aria-label': `明細${idx + 1}の税率` }, [
      h('option', { value: '10' }, ['10%']),
      h('option', { value: '8' }, ['8%（軽減）']),
    ]) as HTMLSelectElement
    rate.value = String(line.rate)
    rate.addEventListener('change', () => { current.lines[idx].rate = (rate.value === '8' ? 8 : 10) as TaxRate; update() })
    const del = h('button', { type: 'button', class: 'secondary small', 'aria-label': `明細${idx + 1}を削除` }, ['削除'])
    del.addEventListener('click', () => {
      if (current.lines.length <= 1) {
        current.lines[0] = { name: '', qty: 1, unitPrice: 0, rate: 10 }
      } else {
        current.lines.splice(idx, 1)
      }
      renderLines()
      update()
    })
    linesBody.append(
      h('tr', {}, [
        h('td', {}, [name]),
        numberCell(idx, 'qty', line.qty),
        numberCell(idx, 'unitPrice', line.unitPrice),
        h('td', {}, [rate]),
        h('td', {}, [del]),
      ]),
    )
  })
}

// ---------- プレビュー（請求書本体） ----------
function jpDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function renderSheet() {
  const c = current
  const t = computeInvoice(c.lines, c.priceMode, c.rounding, c.withholding)
  const reg = data.issuer.registrationNumber.trim()
  const regShown = reg === '' ? '' : isValidRegistrationNumber(reg) ? normalizeRegistrationNumber(reg) : reg
  const hasReduced = c.lines.some((l) => l.rate === 8)
  const amountLabel = c.priceMode === 'exclusive' ? '金額（税抜）' : '金額（税込）'

  const rows = c.lines
    .filter((l) => l.name.trim() !== '' || l.unitPrice !== 0)
    .map((l) =>
      h('tr', {}, [
        h('td', {}, [l.name + (l.rate === 8 ? ' ※' : '')]),
        h('td', { class: 'num' }, [String(l.qty)]),
        h('td', { class: 'num' }, [formatYen(l.unitPrice)]),
        h('td', { class: 'num' }, [`${l.rate}%`]),
        h('td', { class: 'num' }, [formatYen(lineAmount(l.qty, l.unitPrice, c.rounding))]),
      ]),
    )

  const summaryRows: HTMLElement[] = []
  for (const g of t.groups) {
    summaryRows.push(
      h('tr', {}, [h('th', {}, [`${g.rate}%対象 税抜合計`]), h('td', { class: 'num' }, [formatYen(g.subtotal)])]),
      h('tr', {}, [h('th', {}, [`${g.rate}%対象 消費税額`]), h('td', { class: 'num' }, [formatYen(g.tax)])]),
    )
  }
  summaryRows.push(h('tr', { class: 'strong' }, [h('th', {}, ['合計（税込）']), h('td', { class: 'num', id: 'sheet-total' }, [formatYen(t.total)])]))
  if (c.withholding) {
    summaryRows.push(h('tr', {}, [h('th', {}, ['源泉徴収税額']), h('td', { class: 'num', id: 'sheet-withholding' }, ['-' + formatYen(t.withholding)])]))
    summaryRows.push(h('tr', { class: 'strong' }, [h('th', {}, ['差引請求額']), h('td', { class: 'num', id: 'sheet-payable' }, [formatYen(t.payable)])]))
  }

  const issuerLines: (Node | string)[] = [h('strong', {}, [data.issuer.name || '（発行者名）'])]
  if (data.issuer.address) issuerLines.push(h('div', { class: 'pre' }, [data.issuer.address]))
  if (regShown) issuerLines.push(h('div', {}, [`登録番号: ${regShown}`]))
  if (data.issuer.contact) issuerLines.push(h('div', {}, [data.issuer.contact]))

  const children: (Node | string)[] = [
    h('h2', { class: 'sheet-title' }, [regShown ? '請求書（適格請求書）' : '請求書']),
    h('div', { class: 'sheet-head' }, [
      h('div', {}, [
        h('p', { class: 'client' }, [(c.clientName || '（請求先）') + ' 御中']),
        ...(c.subject ? [h('p', {}, [`件名: ${c.subject}`])] : []),
      ]),
      h('div', { class: 'meta' }, [
        h('div', {}, [`請求書番号: ${c.number}`]),
        h('div', {}, [`発行日: ${jpDate(c.issueDate)}`]),
        ...(c.dueDate ? [h('div', {}, [`支払期限: ${jpDate(c.dueDate)}`])] : []),
        h('div', { class: 'issuer' }, issuerLines),
      ]),
    ]),
    h('div', { class: 'amount-box' }, [
      h('span', {}, [c.withholding ? 'ご請求金額（源泉徴収後）' : 'ご請求金額（税込）']),
      h('strong', { id: 'sheet-amount' }, [formatYen(c.withholding ? t.payable : t.total)]),
    ]),
    h('table', { class: 'sheet-lines' }, [
      h('thead', {}, [h('tr', {}, ['品名', '数量', '単価', '税率', amountLabel].map((x) => h('th', {}, [x])))]),
      h('tbody', {}, rows),
    ]),
    ...(hasReduced ? [h('p', { class: 'small-note' }, ['※は軽減税率（8%）対象の品目です。'])] : []),
    h('table', { class: 'sheet-summary' }, [h('tbody', {}, summaryRows)]),
  ]
  if (data.issuer.bank) children.push(h('div', { class: 'block' }, [h('strong', {}, ['お振込先']), h('div', { class: 'pre' }, [data.issuer.bank])]))
  if (c.note) children.push(h('div', { class: 'block' }, [h('strong', {}, ['備考']), h('div', { class: 'pre' }, [c.note])]))
  sheet.replaceChildren(...children)
}

function renderWarnings() {
  const items: string[] = []
  const reg = data.issuer.registrationNumber.trim()
  if (reg === '') items.push('登録番号が未入力です。適格請求書として発行するには、登録番号（T+13桁）が必要です。')
  else if (!isValidRegistrationNumber(reg)) items.push('登録番号の形式が正しくありません（T + 数字13桁）。')
  if (!data.issuer.name.trim()) items.push('発行者の氏名または名称が未入力です。')
  if (!current.clientName.trim()) items.push('請求先（受領者）の名称が未入力です。')
  if (!current.issueDate) items.push('発行日が未入力です。')
  if (invalidFields.size > 0) items.push('数量・単価に数値として読めない入力があります（0として計算しています）。')
  warnings.replaceChildren(...items.map((t) => h('li', {}, [t])))
}

function update() {
  renderSheet()
  renderWarnings()
}

// ---------- 保存済み一覧 ----------
function renderSaved() {
  savedList.replaceChildren()
  if (data.invoices.length === 0) {
    savedList.append(h('li', { class: 'empty' }, ['保存済みの請求書はまだありません。']))
    return
  }
  const sorted = [...data.invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const inv of sorted) {
    const t = computeInvoice(inv.lines, inv.priceMode, inv.rounding, inv.withholding)
    const open = h('button', { type: 'button', class: 'secondary small', 'data-action': 'open' }, ['開く'])
    open.addEventListener('click', () => {
      current = JSON.parse(JSON.stringify(inv)) as Invoice
      mountEditor()
      flash(`請求書 ${inv.number} を開きました。`)
    })
    const del = h('button', { type: 'button', class: 'danger small', 'data-action': 'delete' }, ['削除'])
    let armed = false
    del.addEventListener('click', () => {
      if (!armed) {
        armed = true
        del.textContent = '本当に削除'
        return
      }
      data.invoices = data.invoices.filter((x) => x.id !== inv.id)
      persist()
      renderSaved()
      flash(`請求書 ${inv.number} を削除しました。`)
    })
    savedList.append(
      h('li', {}, [
        h('span', { class: 'saved-main' }, [`${inv.number} / ${inv.clientName || '（請求先未入力）'} / ${formatYen(inv.withholding ? t.payable : t.total)}`]),
        h('span', { class: 'saved-actions' }, [open, del]),
      ]),
    )
  }
}

// ---------- ダウンロード ----------
function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeFileStem(s: string): string {
  const v = s.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return v || 'invoice'
}

function saveCurrent() {
  current.updatedAt = new Date().toISOString()
  const idx = data.invoices.findIndex((x) => x.id === current.id)
  const copy = JSON.parse(JSON.stringify(current)) as Invoice
  if (idx >= 0) data.invoices[idx] = copy
  else {
    data.invoices.push(copy)
    data.nextSeq += 1
  }
  persist()
  renderSaved()
  flash(`請求書 ${current.number} を保存しました。`)
}

function printCurrent() {
  const prev = document.title
  document.title = safeFileStem(current.number) // PDF保存時の既定ファイル名（英数字のみ）
  window.print()
  document.title = prev
}

async function importFile(file: File) {
  const text = await file.text()
  const parsed = parseAppData(text)
  if (!parsed) {
    flash('読み込めませんでした。このツールで書き出したバックアップ(JSON)を選んでください。')
    return
  }
  const map = new Map(data.invoices.map((x) => [x.id, x]))
  for (const inv of parsed.invoices) map.set(inv.id, inv)
  data.invoices = [...map.values()]
  if (parsed.issuer.name) data.issuer = parsed.issuer
  data.nextSeq = Math.max(data.nextSeq, parsed.nextSeq)
  persist()
  mountEditor()
  renderSaved()
  flash(`バックアップを読み込みました（請求書 ${parsed.invoices.length} 件）。`)
}

// ---------- 組み立て ----------
const editorHost = h('div', { id: 'editor' })

function mountEditor() {
  editorHost.replaceChildren(buildIssuerSection(), buildInvoiceSection())
  renderLines()
  const add = editorHost.querySelector('#add-line') as HTMLButtonElement
  add.addEventListener('click', () => {
    current.lines.push({ name: '', qty: 1, unitPrice: 0, rate: 10 } as LineInput)
    renderLines()
    update()
    ;(document.getElementById(`line-${current.lines.length - 1}-name`) as HTMLInputElement).focus()
  })
  update()
}

function buildApp() {
  const btn = (id: string, label: string, cls: string, on: () => void) => {
    const b = h('button', { type: 'button', id, class: cls }, [label])
    b.addEventListener('click', on)
    return b
  }
  const fileInput = h('input', { id: 'import-json', type: 'file', accept: '.json,application/json', class: 'visually-hidden' }) as HTMLInputElement
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]
    if (f) void importFile(f)
    fileInput.value = ''
  })
  const importLabel = h('label', { for: 'import-json', class: 'button secondary' }, ['バックアップを読み込む(JSON)'])

  app.replaceChildren(
    h('header', { class: 'site-header no-print' }, [
      h('h1', {}, ['請求書ジェネレーター']),
      h('p', {}, ['インボイス対応・登録不要・オフラインでも使える。入力内容はこのブラウザの外へ送信されません。']),
    ]),
    h('main', { class: 'layout' }, [
      h('div', { class: 'col-editor' }, [
        editorHost,
        h('section', { class: 'card no-print' }, [
          h('h2', {}, ['保存・出力']),
          h('div', { class: 'actions' }, [
            btn('save', 'この請求書を保存', 'primary', saveCurrent),
            btn('print', '印刷 / PDFで保存', 'primary', printCurrent),
            btn('new-invoice', '新しい請求書', 'secondary', () => {
              current = newInvoice(data.nextSeq)
              mountEditor()
              flash('新しい請求書を作成しました。')
            }),
          ]),
          message,
          warnings,
        ]),
        h('section', { class: 'card no-print' }, [
          h('h2', {}, ['保存済みの請求書']),
          savedList,
          h('div', { class: 'actions' }, [
            btn('export-csv', '一覧をCSVで書き出す', 'secondary', () =>
              download(csvBlob(buildInvoicesCsv(data.invoices)), csvFileName()),
            ),
            btn('export-json', 'バックアップを書き出す(JSON)', 'secondary', () =>
              download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), jsonFileName()),
            ),
            importLabel,
            fileInput,
          ]),
          h('p', { class: 'note' }, ['データはこのブラウザ内にのみ保存されます。ブラウザのデータを消去すると失われるため、定期的にバックアップを書き出してください。']),
        ]),
        h('section', { class: 'card no-print disclaimer' }, [
          h('h2', {}, ['ご利用にあたって']),
          h('p', {}, ['本ツールは請求書作成を補助するもので、税務・法律上の助言ではありません。記載内容・税額計算・源泉徴収の要否は、国税庁の案内等で確認のうえ、必要に応じて税理士等の専門家にご相談ください。']),
        ]),
      ]),
      h('div', { class: 'col-preview' }, [h('h2', { class: 'no-print' }, ['プレビュー']), sheet]),
    ]),
  )
}

buildApp()
mountEditor()
renderSaved()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗してもオンライン動作には影響しない
    })
  })
}
