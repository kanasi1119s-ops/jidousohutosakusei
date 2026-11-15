import './style.css'
import {
  computeInvoice,
  formatYen,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumberLoose,
  validateItems,
} from './calc'
import type { TaxRate } from './calc'
import { backupFileName, buildInvoicesCsvBlob, csvDownloadFileName } from './csv'
import {
  addDays,
  buildBackupBlob,
  emptyItem,
  formatInvoiceNumber,
  formatJaDate,
  isValidDateString,
  mergeData,
  newId,
  newInvoice,
  parseBackupText,
} from './model'
import type { AppData, Invoice, Settings } from './model'
import { clearData, loadData, saveData } from './storage'

// ---------- DOM ヘルパー（利用者入力は必ず textContent 経由。innerHTML は使わない） ----------

type Attrs = Record<string, string | boolean | undefined>

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k === 'class') el.className = String(v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children) {
    if (c === null) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const wrap = h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control)
  if (hint) wrap.append(h('span', { class: 'hint' }, hint))
  return wrap
}

function textInput(id: string, value: string, extra: Attrs = {}): HTMLInputElement {
  const el = h('input', { id, type: 'text', autocomplete: 'off', ...extra })
  el.value = value
  return el
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- 状態 ----------

let data: AppData = loadData()
let draft: Invoice = newInvoice(data.settings)
let raws: { qty: string; price: string }[] = []

function resetRaws(): void {
  raws = draft.items.map((it) => ({ qty: String(it.qty), price: String(it.unitPrice) }))
}
resetRaws()

const statusEl = h('div', { id: 'status', role: 'status', class: 'status no-print' })
function setStatus(msg: string, kind: 'ok' | 'error' = 'ok'): void {
  statusEl.textContent = msg
  statusEl.className = `status no-print ${msg ? kind : ''}`
}

function persist(): boolean {
  const ok = saveData(data)
  if (!ok) setStatus('ブラウザへの保存に失敗しました。JSONバックアップで保存してください。', 'error')
  return ok
}

// ---------- 画面: 請求書作成 ----------

const previewEl = h('article', { id: 'preview', class: 'paper', 'aria-label': '請求書プレビュー' })
const errorsEl = h('ul', { id: 'errors', class: 'errors no-print', role: 'alert' })
const warningsEl = h('ul', { id: 'warnings', class: 'warnings no-print' })
const itemsBody = h('tbody', { id: 'items-body' })
const summaryEl = h('dl', { id: 'summary', class: 'summary no-print' })

const f = {
  clientName: textInput('clientName', draft.clientName, { maxlength: '200' }),
  honorific: h('select', { id: 'honorific' }, h('option', { value: '御中' }, '御中'), h('option', { value: '様' }, '様')),
  subject: textInput('subject', draft.subject, { maxlength: '200' }),
  number: textInput('invoiceNumber', draft.number, { maxlength: '50' }),
  issueDate: h('input', { id: 'issueDate', type: 'date' }),
  dueDate: h('input', { id: 'dueDate', type: 'date' }),
  withholding: h('input', { id: 'withholding', type: 'checkbox' }),
  note: h('textarea', { id: 'note', rows: '3', maxlength: '2000' }),
}

function currentRounding() {
  return data.settings.rounding
}

function itemsOk(): boolean {
  return validateItems(draft.items).length === 0
}

function renderSummary(): void {
  summaryEl.replaceChildren()
  if (!itemsOk()) {
    summaryEl.append(h('dd', {}, '明細を正しく入力すると合計が表示されます。'))
    return
  }
  const t = computeInvoice(draft.items, currentRounding(), draft.withholding)
  const row = (label: string, value: string, id: string, strong = false) => {
    summaryEl.append(h('dt', {}, label), h('dd', { id, class: strong ? 'strong' : '' }, value))
  }
  row('税抜合計', formatYen(t.subtotal), 'sum-subtotal')
  row('消費税', formatYen(t.tax), 'sum-tax')
  if (draft.withholding) row('源泉徴収税額', '-' + formatYen(t.withholding), 'sum-withholding')
  row('請求金額', formatYen(t.total), 'sum-total', true)
}

function refreshAmounts(): void {
  const ok = itemsOk()
  const t = ok ? computeInvoice(draft.items, currentRounding(), draft.withholding) : null
  itemsBody.querySelectorAll<HTMLElement>('.item-amount').forEach((el, i) => {
    el.textContent = t ? formatYen(t.amounts[i]) : '—'
  })
}

function renderPreview(): void {
  const s = data.settings
  const ok = itemsOk()
  const t = ok ? computeInvoice(draft.items, currentRounding(), draft.withholding) : null
  const regOk = isValidRegistrationNumber(s.registrationNumber)

  const issuer = h(
    'div',
    { class: 'p-issuer' },
    h('div', { class: 'p-issuer-name' }, s.issuerName || '（発行者名 未設定）'),
    s.issuerAddress ? h('div', { class: 'pre' }, s.issuerAddress) : null,
    s.issuerTel ? h('div', {}, 'TEL: ' + s.issuerTel) : null,
    s.issuerEmail ? h('div', {}, s.issuerEmail) : null,
    s.registrationNumber ? h('div', {}, '登録番号: ' + s.registrationNumber) : null,
  )

  const meta = h(
    'div',
    { class: 'p-meta' },
    h('div', {}, '請求書番号: ' + draft.number),
    h('div', {}, '発行日: ' + (formatJaDate(draft.issueDate) || '—')),
    draft.dueDate ? h('div', {}, '支払期限: ' + formatJaDate(draft.dueDate)) : null,
  )

  const table = h(
    'table',
    { class: 'p-table' },
    h(
      'thead',
      {},
      h('tr', {}, h('th', {}, '品名'), h('th', { class: 'num' }, '数量'), h('th', { class: 'num' }, '単価'), h('th', { class: 'num' }, '税率'), h('th', { class: 'num' }, '金額(税抜)')),
    ),
    h(
      'tbody',
      {},
      ...draft.items.map((it, i) =>
        h(
          'tr',
          {},
          h('td', {}, (it.taxRate === 8 ? '※ ' : '') + it.name),
          h('td', { class: 'num' }, Number.isFinite(it.qty) ? String(it.qty) : '—'),
          h('td', { class: 'num' }, Number.isFinite(it.unitPrice) ? formatYen(it.unitPrice) : '—'),
          h('td', { class: 'num' }, it.taxRate === 0 ? '非課税等' : it.taxRate + '%'),
          h('td', { class: 'num' }, t ? formatYen(t.amounts[i]) : '—'),
        ),
      ),
    ),
  )

  const totals = h('table', { class: 'p-totals' })
  if (t) {
    for (const g of t.groups) {
      const label = g.rate === 0 ? '非課税・不課税' : g.rate === 8 ? '8%対象(※軽減税率)' : '10%対象'
      totals.append(
        h(
          'tr',
          {},
          h('th', {}, label),
          h('td', { class: 'num' }, formatYen(g.subtotal)),
          h('td', { class: 'num' }, g.rate === 0 ? '' : '消費税 ' + formatYen(g.tax)),
        ),
      )
    }
    totals.append(h('tr', {}, h('th', {}, '税込合計'), h('td', { class: 'num', colspan: '2' }, formatYen(t.grossTotal))))
    if (draft.withholding)
      totals.append(h('tr', {}, h('th', {}, '源泉徴収税額'), h('td', { class: 'num', colspan: '2' }, '-' + formatYen(t.withholding))))
    totals.append(h('tr', { class: 'grand' }, h('th', {}, '請求金額'), h('td', { class: 'num', colspan: '2', id: 'preview-total' }, formatYen(t.total))))
  }

  const nodes: (Node | string | null)[] = [
    h('h2', { class: 'p-title' }, '請求書'),
    h('div', { class: 'p-head' }, h('div', { class: 'p-client' }, h('div', { class: 'p-client-name' }, (draft.clientName || '（宛名 未入力）') + ' ' + draft.honorific), draft.subject ? h('div', {}, '件名: ' + draft.subject) : null), meta),
    t ? h('div', { class: 'p-amount' }, h('span', {}, 'ご請求金額'), h('strong', {}, formatYen(t.total))) : '',
    issuer,
    table,
    totals,
    draft.items.some((it) => it.taxRate === 8) ? h('div', { class: 'p-foot' }, '※ は軽減税率(8%)対象です。') : null,
    data.settings.bankInfo ? h('div', { class: 'p-bank' }, h('div', { class: 'p-bank-title' }, 'お振込先'), h('div', { class: 'pre' }, data.settings.bankInfo)) : null,
    draft.note ? h('div', { class: 'p-note' }, h('div', { class: 'p-bank-title' }, '備考'), h('div', { class: 'pre' }, draft.note)) : null,
  ]
  previewEl.replaceChildren(...nodes.filter((n): n is Node => typeof n !== 'string' && n !== null))

  warningsEl.replaceChildren()
  if (!regOk)
    warningsEl.append(
      h('li', {}, '登録番号（T+数字13桁）が未設定または形式が正しくありません。適格請求書の記載要件を満たさない可能性があります（「設定」タブで入力できます）。'),
    )
  if (!s.issuerName) warningsEl.append(h('li', {}, '発行者名が未設定です（「設定」タブ）。'))
}

function readItemRow(i: number): void {
  const r = raws[i]
  const q = parseNumberLoose(r.qty)
  const p = parseNumberLoose(r.price)
  draft.items[i].qty = q
  draft.items[i].unitPrice = p
}

function onChange(): void {
  refreshAmounts()
  renderSummary()
  renderPreview()
}

function renderItems(): void {
  itemsBody.replaceChildren()
  draft.items.forEach((it, i) => {
    const name = textInput(`item-name-${i}`, it.name, { class: 'item-name', maxlength: '200', 'aria-label': `品名 ${i + 1}行目` })
    name.addEventListener('input', () => {
      draft.items[i].name = name.value
      onChange()
    })
    const qty = textInput(`item-qty-${i}`, raws[i].qty, { class: 'item-qty', inputmode: 'decimal', 'aria-label': `数量 ${i + 1}行目` })
    qty.addEventListener('input', () => {
      raws[i].qty = qty.value
      readItemRow(i)
      onChange()
    })
    const price = textInput(`item-price-${i}`, raws[i].price, { class: 'item-price', inputmode: 'decimal', 'aria-label': `税抜単価 ${i + 1}行目` })
    price.addEventListener('input', () => {
      raws[i].price = price.value
      readItemRow(i)
      onChange()
    })
    const rate = h(
      'select',
      { class: 'item-rate', id: `item-rate-${i}`, 'aria-label': `税率 ${i + 1}行目` },
      h('option', { value: '10' }, '10%'),
      h('option', { value: '8' }, '8%(軽減)'),
      h('option', { value: '0' }, '非課税等'),
    )
    rate.value = String(it.taxRate)
    rate.addEventListener('change', () => {
      draft.items[i].taxRate = Number(rate.value) as TaxRate
      onChange()
    })
    const remove = h('button', { type: 'button', class: 'btn small item-remove', 'aria-label': `${i + 1}行目を削除` }, '削除')
    remove.addEventListener('click', () => {
      if (draft.items.length <= 1) {
        draft.items[0] = emptyItem()
        raws[0] = { qty: '1', price: '0' }
      } else {
        draft.items.splice(i, 1)
        raws.splice(i, 1)
      }
      renderItems()
      onChange()
    })
    itemsBody.append(
      h(
        'tr',
        {},
        h('td', { 'data-label': '品名' }, name),
        h('td', { 'data-label': '数量' }, qty),
        h('td', { 'data-label': '税抜単価' }, price),
        h('td', { 'data-label': '税率' }, rate),
        h('td', { 'data-label': '金額', class: 'item-amount num' }, '—'),
        h('td', {}, remove),
      ),
    )
  })
  refreshAmounts()
}

function loadDraftIntoForm(): void {
  f.clientName.value = draft.clientName
  f.honorific.value = draft.honorific
  f.subject.value = draft.subject
  f.number.value = draft.number
  f.issueDate.value = draft.issueDate
  f.dueDate.value = draft.dueDate
  f.withholding.checked = draft.withholding
  f.note.value = draft.note
  resetRaws()
  renderItems()
  errorsEl.replaceChildren()
  onChange()
}

function collectErrors(): string[] {
  const errs: string[] = []
  if (draft.clientName.trim() === '') errs.push('宛名（取引先名）を入力してください。')
  if (draft.number.trim() === '') errs.push('請求書番号を入力してください。')
  if (!isValidDateString(draft.issueDate)) errs.push('発行日を正しく入力してください。')
  if (draft.dueDate !== '' && !isValidDateString(draft.dueDate)) errs.push('支払期限の日付が正しくありません。')
  if (isValidDateString(draft.issueDate) && isValidDateString(draft.dueDate) && draft.dueDate < draft.issueDate)
    errs.push('支払期限が発行日より前になっています。')
  errs.push(...validateItems(draft.items).map((i) => i.message))
  return errs
}

function saveDraft(): void {
  const errs = collectErrors()
  errorsEl.replaceChildren(...errs.map((e) => h('li', {}, e)))
  if (errs.length > 0) {
    setStatus('入力内容を確認してください。', 'error')
    return
  }
  const existing = data.invoices.findIndex((i) => i.id === draft.id)
  const saved: Invoice = { ...draft, items: draft.items.map((x) => ({ ...x })), updatedAt: new Date().toISOString() }
  if (existing >= 0) {
    data.invoices[existing] = saved
  } else {
    data.invoices.push(saved)
    if (saved.number === formatInvoiceNumber(data.settings)) data.settings.nextSeq += 1
  }
  if (persist()) setStatus(`請求書 ${saved.number} を保存しました。`)
  renderList()
}

function startNew(): void {
  draft = newInvoice(data.settings)
  loadDraftIntoForm()
  setStatus('')
}

function bindFields(): void {
  f.clientName.addEventListener('input', () => ((draft.clientName = f.clientName.value), onChange()))
  f.honorific.addEventListener('change', () => ((draft.honorific = f.honorific.value === '様' ? '様' : '御中'), onChange()))
  f.subject.addEventListener('input', () => ((draft.subject = f.subject.value), onChange()))
  f.number.addEventListener('input', () => ((draft.number = f.number.value), onChange()))
  f.issueDate.addEventListener('change', () => {
    draft.issueDate = f.issueDate.value
    // 発行日を変えたら、支払期限も設定の日数で再計算する
    if (isValidDateString(draft.issueDate)) {
      draft.dueDate = addDays(draft.issueDate, data.settings.dueDays)
      f.dueDate.value = draft.dueDate
    }
    onChange()
  })
  f.dueDate.addEventListener('change', () => ((draft.dueDate = f.dueDate.value), onChange()))
  f.withholding.addEventListener('change', () => ((draft.withholding = f.withholding.checked), onChange()))
  f.note.addEventListener('input', () => ((draft.note = f.note.value), onChange()))
}

function buildCreateTab(): HTMLElement {
  const addBtn = h('button', { type: 'button', id: 'add-item', class: 'btn' }, '＋ 明細を追加')
  addBtn.addEventListener('click', () => {
    if (draft.items.length >= 100) return setStatus('明細は100行までです。', 'error')
    draft.items.push(emptyItem())
    raws.push({ qty: '1', price: '0' })
    renderItems()
    onChange()
  })
  const saveBtn = h('button', { type: 'button', id: 'save-invoice', class: 'btn primary' }, '保存する')
  saveBtn.addEventListener('click', saveDraft)
  const newBtn = h('button', { type: 'button', id: 'new-invoice', class: 'btn' }, '新しい請求書')
  newBtn.addEventListener('click', startNew)
  const printBtn = h('button', { type: 'button', id: 'print-invoice', class: 'btn' }, '印刷 / PDFとして保存')
  printBtn.addEventListener('click', () => {
    const errs = collectErrors()
    errorsEl.replaceChildren(...errs.map((e) => h('li', {}, e)))
    if (errs.length > 0) return setStatus('入力内容を確認してください。', 'error')
    window.print()
  })

  f.issueDate.value = draft.issueDate
  f.dueDate.value = draft.dueDate
  bindFields()
  renderItems()

  return h(
    'section',
    { id: 'tab-create', class: 'tab', 'aria-labelledby': 'tabbtn-create' },
    h(
      'div',
      { class: 'card no-print' },
      h('h2', {}, '請求書を作る'),
      h('div', { class: 'grid2' }, field('宛名（取引先名）', f.clientName), field('敬称', f.honorific)),
      field('件名（任意）', f.subject),
      h('div', { class: 'grid3' }, field('請求書番号', f.number), field('発行日', f.issueDate), field('支払期限', f.dueDate)),
      h(
        'table',
        { class: 'items' },
        h('thead', {}, h('tr', {}, h('th', {}, '品名'), h('th', {}, '数量'), h('th', {}, '税抜単価(円)'), h('th', {}, '税率'), h('th', { class: 'num' }, '金額(税抜)'), h('th', {}, ''))),
        itemsBody,
      ),
      addBtn,
      h('label', { class: 'check' }, f.withholding, h('span', {}, '源泉徴収を行う（報酬・料金等。税抜金額に対して10.21%／100万円超の部分は20.42%）')),
      field('備考（任意）', f.note),
      summaryEl,
      errorsEl,
      warningsEl,
      h('div', { class: 'actions' }, saveBtn, printBtn, newBtn),
    ),
    h('h2', { class: 'no-print' }, 'プレビュー'),
    previewEl,
  )
}

// ---------- 画面: 保存済み ----------

const listBody = h('tbody', { id: 'list-body' })
const listEmpty = h('p', { id: 'list-empty', class: 'muted' }, 'まだ保存された請求書はありません。')

function renderList(): void {
  listBody.replaceChildren()
  const sorted = [...data.invoices].sort((a, b) => (a.issueDate === b.issueDate ? b.number.localeCompare(a.number) : b.issueDate.localeCompare(a.issueDate)))
  listEmpty.classList.toggle('hidden', sorted.length > 0)
  for (const inv of sorted) {
    const t = computeInvoice(inv.items, currentRounding(), inv.withholding)
    const open = h('button', { type: 'button', class: 'btn small open-invoice' }, '開く')
    open.addEventListener('click', () => {
      draft = { ...inv, items: inv.items.map((x) => ({ ...x })) }
      loadDraftIntoForm()
      f.issueDate.value = draft.issueDate
      showTab('create')
      setStatus(`請求書 ${inv.number} を開きました。`)
    })
    const copy = h('button', { type: 'button', class: 'btn small copy-invoice' }, '複製')
    copy.addEventListener('click', () => {
      const base = newInvoice(data.settings)
      draft = { ...inv, id: newId(), number: base.number, issueDate: base.issueDate, dueDate: base.dueDate, items: inv.items.map((x) => ({ ...x })) }
      loadDraftIntoForm()
      showTab('create')
      setStatus('複製しました。内容を確認して保存してください。')
    })
    const del = h('button', { type: 'button', class: 'btn small danger delete-invoice' }, '削除')
    del.addEventListener('click', () => {
      if (!window.confirm(`請求書 ${inv.number} を削除しますか？この操作は元に戻せません。`)) return
      data.invoices = data.invoices.filter((x) => x.id !== inv.id)
      if (persist()) setStatus('削除しました。')
      renderList()
    })
    listBody.append(
      h(
        'tr',
        {},
        h('td', { 'data-label': '番号' }, inv.number),
        h('td', { 'data-label': '発行日' }, inv.issueDate),
        h('td', { 'data-label': '宛名' }, inv.clientName + inv.honorific),
        h('td', { 'data-label': '請求金額', class: 'num' }, formatYen(t.total)),
        h('td', { class: 'row-actions' }, open, copy, del),
      ),
    )
  }
}

function buildListTab(): HTMLElement {
  return h(
    'section',
    { id: 'tab-list', class: 'tab hidden', 'aria-labelledby': 'tabbtn-list' },
    h(
      'div',
      { class: 'card' },
      h('h2', {}, '保存済みの請求書'),
      listEmpty,
      h('table', { class: 'items list' }, h('thead', {}, h('tr', {}, h('th', {}, '番号'), h('th', {}, '発行日'), h('th', {}, '宛名'), h('th', { class: 'num' }, '請求金額'), h('th', {}, ''))), listBody),
    ),
  )
}

// ---------- 画面: 設定 ----------

function buildSettingsTab(): HTMLElement {
  const s = data.settings
  const issuerName = textInput('issuerName', s.issuerName, { maxlength: '200' })
  const regNo = textInput('registrationNumber', s.registrationNumber, { maxlength: '20', placeholder: 'T1234567890123' })
  const address = h('textarea', { id: 'issuerAddress', rows: '2', maxlength: '500' })
  address.value = s.issuerAddress
  const tel = textInput('issuerTel', s.issuerTel, { maxlength: '50' })
  const email = textInput('issuerEmail', s.issuerEmail, { maxlength: '200' })
  const bank = h('textarea', { id: 'bankInfo', rows: '3', maxlength: '500', placeholder: '例: ○○銀行 △△支店 普通 1234567 カ）サンプル' })
  bank.value = s.bankInfo
  const rounding = h('select', { id: 'rounding' }, h('option', { value: 'floor' }, '切り捨て'), h('option', { value: 'round' }, '四捨五入'), h('option', { value: 'ceil' }, '切り上げ'))
  rounding.value = s.rounding
  const dueDays = textInput('dueDays', String(s.dueDays), { inputmode: 'numeric' })
  const prefix = textInput('numberPrefix', s.numberPrefix, { maxlength: '20' })
  const nextSeq = textInput('nextSeq', String(s.nextSeq), { inputmode: 'numeric' })
  const regHint = h('span', { id: 'reg-hint', class: 'hint' }, '')
  const msg = h('p', { id: 'settings-msg', role: 'status', class: 'muted' })

  const updateRegHint = () => {
    const v = normalizeRegistrationNumber(regNo.value)
    regHint.textContent = v === '' ? '適格請求書発行事業者の登録番号（T＋数字13桁）。未登録の場合は空欄のままにしてください。' : isValidRegistrationNumber(v) ? '形式OK（登録の実在確認は国税庁の公表サイトで行ってください）' : '形式が正しくありません（T＋数字13桁）'
  }
  regNo.addEventListener('input', updateRegHint)
  updateRegHint()

  const save = h('button', { type: 'button', id: 'save-settings', class: 'btn primary' }, '設定を保存')
  save.addEventListener('click', () => {
    const reg = normalizeRegistrationNumber(regNo.value)
    const days = parseNumberLoose(dueDays.value)
    const seq = parseNumberLoose(nextSeq.value)
    const errs: string[] = []
    if (reg !== '' && !isValidRegistrationNumber(reg)) errs.push('登録番号は「T＋数字13桁」で入力してください。')
    if (!Number.isInteger(days) || days < 0 || days > 365) errs.push('支払期限の日数は0〜365の整数にしてください。')
    if (!Number.isInteger(seq) || seq < 1 || seq > 99_999_999) errs.push('次の請求書番号（連番）は1以上の整数にしてください。')
    if (errs.length > 0) {
      msg.textContent = errs.join(' ')
      msg.className = 'status error'
      return
    }
    const next: Settings = {
      issuerName: issuerName.value.trim(),
      registrationNumber: reg,
      issuerAddress: address.value,
      issuerTel: tel.value.trim(),
      issuerEmail: email.value.trim(),
      bankInfo: bank.value,
      rounding: rounding.value === 'round' || rounding.value === 'ceil' ? rounding.value : 'floor',
      dueDays: days,
      numberPrefix: prefix.value.trim(),
      nextSeq: seq,
    }
    data.settings = next
    regNo.value = reg
    // 未保存の新規下書きの番号も新しい設定に合わせる
    if (!data.invoices.some((i) => i.id === draft.id) && draft.items.every((it) => it.name === '')) {
      draft.number = formatInvoiceNumber(next)
      f.number.value = draft.number
    }
    if (persist()) {
      msg.textContent = '設定を保存しました。'
      msg.className = 'status ok'
    }
    onChange()
    renderList()
  })

  return h(
    'section',
    { id: 'tab-settings', class: 'tab hidden', 'aria-labelledby': 'tabbtn-settings' },
    h(
      'div',
      { class: 'card' },
      h('h2', {}, '発行者情報・設定'),
      h('p', { class: 'muted' }, 'ここで入力した内容はこのブラウザ内にのみ保存され、外部には送信されません。'),
      field('発行者名（屋号・氏名・会社名）', issuerName),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, '適格請求書発行事業者の登録番号'), regNo, regHint),
      field('住所', address),
      h('div', { class: 'grid2' }, field('電話番号', tel), field('メールアドレス', email)),
      field('振込先', bank),
      h('div', { class: 'grid2' }, field('端数処理（金額・消費税）', rounding), field('支払期限（発行日から何日後）', dueDays)),
      h('div', { class: 'grid2' }, field('請求書番号の接頭辞', prefix), field('次の請求書番号（連番）', nextSeq)),
      h('div', { class: 'actions' }, save),
      msg,
    ),
  )
}

// ---------- 画面: データ ----------

function buildDataTab(): HTMLElement {
  const msg = h('p', { id: 'data-msg', role: 'status', class: 'muted' })
  const exportJson = h('button', { type: 'button', id: 'export-json', class: 'btn' }, 'バックアップ(JSON)をダウンロード')
  exportJson.addEventListener('click', () => {
    download(buildBackupBlob(data), backupFileName())
    msg.textContent = 'バックアップを書き出しました。'
  })
  const exportCsv = h('button', { type: 'button', id: 'export-csv', class: 'btn' }, '請求書一覧(CSV)をダウンロード')
  exportCsv.addEventListener('click', () => {
    download(buildInvoicesCsvBlob(data.invoices, data.settings.rounding), csvDownloadFileName())
    msg.textContent = 'CSVを書き出しました（Excelで開いても文字化けしないBOM付きUTF-8）。'
  })
  const importInput = h('input', { id: 'import-json', type: 'file', accept: 'application/json,.json' })
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('ファイルが大きすぎます（20MBまで）。')
      const incoming = parseBackupText(await file.text())
      data = mergeData(data, incoming)
      if (persist()) {
        msg.textContent = `インポートしました（請求書 ${incoming.invoices.length} 件を取り込み）。`
        msg.className = 'status ok'
      }
      renderList()
      startNew()
      setStatus('')
    } catch (e) {
      msg.textContent = e instanceof Error ? e.message : 'インポートに失敗しました。'
      msg.className = 'status error'
    } finally {
      importInput.value = ''
    }
  })
  const clear = h('button', { type: 'button', id: 'clear-data', class: 'btn danger' }, 'このブラウザのデータをすべて削除')
  clear.addEventListener('click', () => {
    if (!window.confirm('保存した請求書と設定をすべて削除します。先にバックアップをお勧めします。よろしいですか？')) return
    clearData()
    data = loadData()
    renderList()
    startNew()
    msg.textContent = 'すべて削除しました。'
  })
  return h(
    'section',
    { id: 'tab-data', class: 'tab hidden', 'aria-labelledby': 'tabbtn-data' },
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'データの保存・バックアップ'),
      h('p', {}, 'データはこのブラウザ（このサイトのlocalStorage）にだけ保存されます。ブラウザのデータ消去や端末の変更で失われるため、定期的にバックアップしてください。'),
      h('div', { class: 'actions' }, exportJson, exportCsv),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'バックアップから復元（JSON）'), importInput, h('span', { class: 'hint' }, '同じ請求書は上書き、新しいものは追加されます。')),
      h('div', { class: 'actions' }, clear),
      msg,
    ),
  )
}

// ---------- 全体 ----------

const tabs = ['create', 'list', 'settings', 'data'] as const
type Tab = (typeof tabs)[number]
const tabLabels: Record<Tab, string> = { create: '請求書作成', list: '保存済み', settings: '設定', data: 'データ' }

function showTab(tab: Tab): void {
  for (const t of tabs) {
    document.getElementById(`tab-${t}`)?.classList.toggle('hidden', t !== tab)
    const b = document.getElementById(`tabbtn-${t}`)
    b?.setAttribute('aria-selected', String(t === tab))
    b?.classList.toggle('active', t === tab)
  }
}

function init(): void {
  const nav = h('nav', { class: 'tabs no-print', 'aria-label': 'メニュー' })
  for (const t of tabs) {
    const b = h('button', { type: 'button', id: `tabbtn-${t}`, class: 'tabbtn', 'aria-selected': String(t === 'create') }, tabLabels[t])
    b.addEventListener('click', () => showTab(t))
    nav.append(b)
  }
  const app = document.getElementById('app')!
  app.append(
    h(
      'header',
      { class: 'no-print' },
      h('h1', {}, '請求書メーカー'),
      h('p', { class: 'subtitle' }, '適格請求書（インボイス）対応・登録不要・オフラインで使えます'),
      h('span', { class: 'privacy-badge' }, '入力データはこのブラウザの外に送信されません'),
    ),
    nav,
    statusEl,
    buildCreateTab(),
    buildListTab(),
    buildSettingsTab(),
    buildDataTab(),
    h(
      'footer',
      { class: 'disclaimer no-print' },
      h('p', {}, '本ツールは請求書作成の補助を目的としたもので、税務・法律上の助言ではありません。記載内容・税額の最終確認は利用者ご自身（必要に応じて税理士等の専門家）で行ってください。適格請求書の記載事項は国税庁の公表資料をご確認ください。'),
    ),
  )
  renderList()
  onChange()
  showTab('create')

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Service Worker が登録できなくても通常機能は動作する
      })
    })
  }
}

init()
