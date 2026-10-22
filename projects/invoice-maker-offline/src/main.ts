import './style.css'
import { computeInvoice, formatMilli, parseMilli, MAX_LINES } from './calc'
import type { InvoiceCalc, LineInput, RoundingMode, TaxRate } from './calc'
import { checkQualifiedInvoice } from './checks'
import { buildItemsCsvBlob, csvFileName, jsonFileName } from './csv'
import { checkRegistrationNumber } from './registration'
import { getStorage, loadAppData, parseImportedJson, saveAppData, serializeAppData } from './storage'
import { DOC_TYPE_LABELS, emptyDoc, emptyIssuer, newId, todayIso } from './types'
import type { AppData, DocType, InvoiceDoc, IssuerInfo } from './types'

const storage = getStorage()
const data: AppData = loadAppData(storage)
let doc: InvoiceDoc = data.draft ?? emptyDoc()

type Child = Node | string | null | undefined
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) if (c != null) e.append(c)
  return e
}

const yen = (n: number): string => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`

function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', {}, label, control)
}

const app = document.getElementById('app') as HTMLElement
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

function buildShell(): void {
  const docTypeSel = h('select', { id: 'docType' })
  for (const [v, l] of Object.entries(DOC_TYPE_LABELS)) docTypeSel.append(h('option', { value: v }, l))
  const roundSel = h('select', { id: 'rounding' })
  roundSel.append(
    h('option', { value: 'floor' }, '切り捨て'),
    h('option', { value: 'round' }, '四捨五入'),
    h('option', { value: 'ceil' }, '切り上げ'),
  )

  app.append(
    h(
      'div',
      { class: 'wrap' },
      h(
        'header',
        { class: 'no-print' },
        h('h1', {}, '請求書メーカー'),
        h('p', { class: 'lead' }, '請求書・見積書・納品書・領収書を作成し、適格請求書の記載要件をチェックします。'),
        h(
          'ul',
          { class: 'badges' },
          h('li', {}, '登録不要'),
          h('li', {}, 'オフライン対応'),
          h('li', {}, '入力データは端末内にのみ保存'),
        ),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '1. 書類情報'),
        h(
          'div',
          { class: 'grid three' },
          field('書類の種類', docTypeSel),
          field('書類番号', h('input', { id: 'docNumber', type: 'text', maxlength: '50', placeholder: '例: 2026-001' })),
          field('宛名（取引先名）', h('input', { id: 'clientName', type: 'text', maxlength: '200', placeholder: '例: 株式会社サンプル' })),
          field('発行日（取引年月日）', h('input', { id: 'issueDate', type: 'date' })),
          field('支払期限', h('input', { id: 'dueDate', type: 'date' })),
        ),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '2. 発行者情報（自動で保存されます）'),
        h(
          'div',
          { class: 'grid two' },
          field('氏名または名称', h('input', { id: 'issuerName', type: 'text', maxlength: '200' })),
          field('適格請求書発行事業者の登録番号', h('input', { id: 'issuerReg', type: 'text', maxlength: '40', placeholder: 'T1234567890123' })),
          field('住所', h('textarea', { id: 'issuerAddress', maxlength: '2000' })),
          field('連絡先（電話・メール）', h('input', { id: 'issuerContact', type: 'text', maxlength: '200' })),
          field('振込先', h('textarea', { id: 'bankInfo', maxlength: '2000', placeholder: '例: ○○銀行 △△支店 普通 1234567' })),
        ),
        h('p', { id: 'reg-message', class: 'notice' }),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '3. 明細'),
        h(
          'div',
          { class: 'items-scroll' },
          h(
            'table',
            { class: 'items' },
            h('thead', {}, h('tr', {}, ...['品名', '数量', '単価（税抜・円）', '税率', '金額（税抜）', ''].map((t) => h('th', {}, t)))),
            h('tbody', { id: 'items-body' }),
          ),
        ),
        h('div', { id: 'errors', class: 'errors', role: 'alert' }),
        h('div', { class: 'actions' }, h('button', { id: 'add-line', type: 'button' }, '行を追加')),
        h(
          'div',
          { class: 'grid two' },
          field('端数処理（税額・金額）', roundSel),
          h(
            'label',
            { class: 'check' },
            h('input', { id: 'withholding', type: 'checkbox' }),
            '源泉徴収を差し引く（報酬・料金。10.21%、100万円超は超過分20.42%）',
          ),
        ),
        field('備考', h('textarea', { id: 'notes', maxlength: '2000' })),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '4. 計算結果'),
        h('table', { class: 'sum' }, h('tbody', { id: 'sum-body' })),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '5. 適格請求書の記載要件チェック'),
        h('ul', { id: 'checklist', class: 'checklist' }),
        h('p', { class: 'notice' }, '簡易的な確認です。税務上の最終判断は国税庁の資料または税理士にご確認ください。'),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', { class: 'no-print' }, '6. プレビュー・出力'),
        h('div', { class: 'paper-wrap' }, h('div', { id: 'preview', class: 'paper' })),
        h(
          'div',
          { class: 'actions no-print' },
          h('button', { id: 'print', type: 'button', class: 'primary' }, '印刷 / PDFで保存'),
          h('button', { id: 'export-csv', type: 'button' }, '明細をCSVで保存'),
        ),
        h('p', { class: 'notice no-print' }, 'PDF保存は、印刷画面で保存先に「PDFに保存」を選んでください。'),
      ),
      h(
        'section',
        { class: 'card no-print' },
        h('h2', {}, '7. 保存した書類・バックアップ'),
        h(
          'div',
          { class: 'actions' },
          h('button', { id: 'save-doc', type: 'button', class: 'primary' }, 'この書類を保存'),
          h('button', { id: 'new-doc', type: 'button' }, '新しい書類を作る'),
          h('button', { id: 'copy-doc', type: 'button' }, '複製して新しい書類にする'),
        ),
        h('p', { id: 'status', class: 'status', role: 'status' }),
        h('ul', { id: 'saved-list', class: 'saved-list' }),
        h(
          'div',
          { class: 'actions' },
          h('button', { id: 'export-json', type: 'button' }, 'バックアップ（JSON）を保存'),
          h('label', { class: 'check' }, 'バックアップを読み込む', h('input', { id: 'import-json', type: 'file', accept: '.json,application/json' })),
        ),
        h('p', { class: 'notice' }, 'データはこのブラウザの中にだけ保存されます。ブラウザのデータを消去すると失われるため、定期的にバックアップを保存してください。'),
      ),
      h(
        'footer',
        { class: 'site no-print' },
        h('p', {}, '本ツールは書類作成の補助であり、税務・法律上の助言ではありません。入力内容・計算結果・登録番号は発行者の責任でご確認ください。'),
        h('p', {}, '入力データは外部に送信されません（アクセス解析・外部通信なし）。'),
      ),
    ),
  )
}

function setText(id: string, v: string): void {
  ;($(id) as HTMLInputElement).value = v
}

function writeForm(): void {
  ;($('docType') as HTMLSelectElement).value = doc.docType
  setText('docNumber', doc.number)
  setText('clientName', doc.clientName)
  setText('issueDate', doc.issueDate)
  setText('dueDate', doc.dueDate)
  setText('rounding', doc.rounding)
  ;($('withholding') as HTMLInputElement).checked = doc.withholding
  setText('notes', doc.notes)
  setText('issuerName', data.issuer.name)
  setText('issuerReg', data.issuer.registrationNumber)
  setText('issuerAddress', data.issuer.address)
  setText('issuerContact', data.issuer.contact)
  setText('bankInfo', data.issuer.bankInfo)
  renderItemRows()
}

function readForm(): void {
  const v = (id: string): string => ($(id) as HTMLInputElement).value
  doc.docType = v('docType') as DocType
  doc.number = v('docNumber')
  doc.clientName = v('clientName')
  doc.issueDate = v('issueDate')
  doc.dueDate = v('dueDate')
  doc.rounding = v('rounding') as RoundingMode
  doc.withholding = ($('withholding') as HTMLInputElement).checked
  doc.notes = v('notes')
  data.issuer = {
    name: v('issuerName'),
    registrationNumber: v('issuerReg'),
    address: v('issuerAddress'),
    contact: v('issuerContact'),
    bankInfo: v('bankInfo'),
  }
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('#items-body tr'))
  doc.items = rows.map((tr) => ({
    description: (tr.querySelector('.li-desc') as HTMLInputElement).value,
    quantity: (tr.querySelector('.li-qty') as HTMLInputElement).value,
    unitPrice: (tr.querySelector('.li-price') as HTMLInputElement).value,
    taxRate: Number((tr.querySelector('.li-rate') as HTMLSelectElement).value) as TaxRate,
  }))
}

function renderItemRows(): void {
  const body = $('items-body')
  body.replaceChildren()
  doc.items.forEach((it, i) => {
    const rate = h('select', { class: 'li-rate', 'aria-label': `${i + 1}行目の税率` })
    rate.append(h('option', { value: '10' }, '10%'), h('option', { value: '8' }, '8%（軽減）'), h('option', { value: '0' }, '非課税・不課税'))
    rate.value = String(it.taxRate)
    const desc = h('input', { class: 'li-desc', type: 'text', maxlength: '200', 'aria-label': `${i + 1}行目の品名` })
    desc.value = it.description
    const qty = h('input', { class: 'li-qty', type: 'text', inputmode: 'decimal', 'aria-label': `${i + 1}行目の数量` })
    qty.value = it.quantity
    const price = h('input', { class: 'li-price', type: 'text', inputmode: 'decimal', 'aria-label': `${i + 1}行目の単価` })
    price.value = it.unitPrice
    const del = h('button', { type: 'button', class: 'danger li-del', 'aria-label': `${i + 1}行目を削除` }, '削除')
    del.addEventListener('click', () => {
      readForm()
      doc.items.splice(i, 1)
      if (doc.items.length === 0) doc.items.push({ description: '', quantity: '1', unitPrice: '', taxRate: 10 })
      renderItemRows()
      refresh()
    })
    body.append(
      h(
        'tr',
        {},
        h('td', { class: 'col-desc' }, desc),
        h('td', {}, qty),
        h('td', {}, price),
        h('td', {}, rate),
        h('td', { class: 'amount li-amount' }),
        h('td', {}, del),
      ),
    )
  })
}

function renderCalc(calc: InvoiceCalc): void {
  document.querySelectorAll<HTMLElement>('#items-body .li-amount').forEach((td, i) => {
    const l = calc.lines[i]
    td.textContent = l && l.status === 'ok' ? yen(l.amount) : ''
  })
  $('errors').textContent = calc.errors.join(' / ')

  const body = $('sum-body')
  body.replaceChildren()
  const row = (label: string, value: string, cls = ''): void => {
    body.append(h('tr', cls ? { class: cls } : {}, h('td', {}, label), h('td', {}, value)))
  }
  for (const b of calc.byRate) {
    const name = b.rate === 0 ? '非課税・不課税' : `${b.rate}%対象`
    row(`${name} 小計（税抜）`, yen(b.subtotal))
    if (b.rate !== 0) row(`${b.rate}% 消費税額`, yen(b.tax))
  }
  row('合計（税込）', yen(calc.total), 'total')
  if (doc.withholding) {
    row('源泉徴収税額', yen(-calc.withholding))
    row('差引請求額', yen(calc.payable), 'total')
  }
}

function renderChecklist(calc: InvoiceCalc): void {
  const ul = $('checklist')
  ul.replaceChildren()
  for (const c of checkQualifiedInvoice(doc, data.issuer, calc)) {
    ul.append(
      h(
        'li',
        { class: c.ok ? 'ok' : 'ng', 'data-check': c.id },
        h('span', { class: 'mark' }, c.ok ? '✔' : '✖'),
        c.label,
        h('small', {}, c.detail),
      ),
    )
  }
  const reg = checkRegistrationNumber(data.issuer.registrationNumber)
  $('reg-message').textContent = data.issuer.registrationNumber.trim() === '' ? '' : reg.message
}

function td(text: string, cls = ''): HTMLTableCellElement {
  return h('td', cls ? { class: cls } : {}, text)
}

function renderPreview(calc: InvoiceCalc): void {
  const p = $('preview')
  p.replaceChildren()
  const issuer: IssuerInfo = data.issuer
  const title = DOC_TYPE_LABELS[doc.docType]
  const reg = checkRegistrationNumber(issuer.registrationNumber)
  const honorific = doc.docType === 'receipt' ? ' 様' : ' 御中'

  const issuerBlock = h('div', {}, h('strong', {}, issuer.name || '（発行者名）'))
  if (issuer.address) issuerBlock.append(h('div', { class: 'pre small' }, issuer.address))
  if (issuer.contact) issuerBlock.append(h('div', { class: 'small' }, issuer.contact))
  if (reg.valid) issuerBlock.append(h('div', { class: 'small' }, `登録番号: ${reg.normalized}`))

  const meta = h('div', {}, h('div', {}, `書類番号: ${doc.number || '-'}`), h('div', {}, `発行日: ${doc.issueDate || '-'}`))
  if (doc.dueDate && doc.docType === 'invoice') meta.append(h('div', {}, `お支払期限: ${doc.dueDate}`))

  p.append(
    h('h3', {}, title),
    h('div', { class: 'head' }, h('div', {}, h('span', { class: 'to' }, (doc.clientName || '（宛名）') + honorific)), h('div', {}, meta, issuerBlock)),
  )

  const headline = doc.withholding ? '差引請求額' : '合計金額（税込）'
  p.append(h('div', { class: 'big' }, `${doc.docType === 'receipt' ? '領収金額' : headline}: ${yen(calc.payable)}`))
  if (doc.docType === 'receipt') p.append(h('div', { class: 'small' }, '上記正に領収いたしました。'))

  const tbody = h('tbody')
  doc.items.forEach((it, i) => {
    const l = calc.lines[i]
    if (!l || l.status !== 'ok') return
    const q = parseMilli(it.quantity)
    const u = parseMilli(it.unitPrice)
    tbody.append(
      h(
        'tr',
        {},
        td(it.description + (it.taxRate === 8 ? ' ※' : '')),
        td(q === null ? '' : formatMilli(q), 'num'),
        td(u === null ? '' : formatMilli(u), 'num'),
        td(it.taxRate === 0 ? '非課税' : `${it.taxRate}%`, 'num'),
        td(yen(l.amount), 'num'),
      ),
    )
  })
  p.append(
    h('table', {}, h('thead', {}, h('tr', {}, ...['品名', '数量', '単価', '税率', '金額（税抜）'].map((t) => h('th', {}, t)))), tbody),
  )
  if (doc.items.some((it, i) => it.taxRate === 8 && calc.lines[i]?.status === 'ok')) {
    p.append(h('div', { class: 'small' }, '※は軽減税率（8%）対象品目です。'))
  }

  const sumBody = h('tbody')
  for (const b of calc.byRate) {
    sumBody.append(
      h('tr', {}, td(b.rate === 0 ? '非課税・不課税' : `${b.rate}%対象`), td(yen(b.subtotal), 'num'), td(b.rate === 0 ? '-' : yen(b.tax), 'num')),
    )
  }
  p.append(
    h('table', {}, h('thead', {}, h('tr', {}, ...['税率区分', '対象額（税抜）', '消費税額'].map((t) => h('th', {}, t)))), sumBody),
    h('div', {}, `合計（税込）: ${yen(calc.total)}`),
  )
  if (doc.withholding) {
    p.append(h('div', {}, `源泉徴収税額: ${yen(-calc.withholding)}`))
  }
  if (issuer.bankInfo && doc.docType === 'invoice') {
    p.append(h('div', { class: 'small' }, '振込先'), h('div', { class: 'pre small' }, issuer.bankInfo))
  }
  if (doc.notes) p.append(h('div', { class: 'small' }, '備考'), h('div', { class: 'pre small' }, doc.notes))
}

function renderSavedList(): void {
  const ul = $('saved-list')
  ul.replaceChildren()
  if (data.docs.length === 0) {
    ul.append(h('li', { class: 'notice' }, '保存した書類はまだありません。'))
    return
  }
  const sorted = [...data.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const d of sorted) {
    const load = h('button', { type: 'button', class: 'load-doc' }, '開く')
    load.addEventListener('click', () => {
      doc = structuredClone(d)
      writeForm()
      refresh()
      setStatus('書類を開きました。')
    })
    const del = h('button', { type: 'button', class: 'danger delete-doc' }, '削除')
    del.addEventListener('click', () => {
      if (!window.confirm('この書類を削除しますか？')) return
      data.docs = data.docs.filter((x) => x.id !== d.id)
      persist()
      renderSavedList()
      setStatus('削除しました。')
    })
    ul.append(
      h('li', {}, h('span', { class: 'grow' }, `${DOC_TYPE_LABELS[d.docType]} ${d.number || '(番号なし)'} / ${d.clientName || '(宛名なし)'} / ${d.issueDate}`), load, del),
    )
  }
}

function setStatus(msg: string): void {
  $('status').textContent = msg
}

function persist(): boolean {
  data.draft = doc
  return saveAppData(storage, data)
}

function refresh(): void {
  const calc = computeInvoice(doc.items, doc.rounding, doc.withholding)
  renderCalc(calc)
  renderChecklist(calc)
  renderPreview(calc)
}

function onInput(): void {
  readForm()
  doc.updatedAt = new Date().toISOString()
  refresh()
  persist()
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function bind(): void {
  const form = app
  form.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).id === 'import-json') return
    onInput()
  })
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).id === 'import-json') return
    onInput()
  })
  $('add-line').addEventListener('click', () => {
    readForm()
    if (doc.items.length >= MAX_LINES) {
      setStatus(`明細は${MAX_LINES}行までです。`)
      return
    }
    doc.items.push({ description: '', quantity: '1', unitPrice: '', taxRate: 10 } as LineInput)
    renderItemRows()
    refresh()
    persist()
  })
  $('print').addEventListener('click', () => window.print())
  $('export-csv').addEventListener('click', () => {
    readForm()
    const calc = computeInvoice(doc.items, doc.rounding, doc.withholding)
    download(buildItemsCsvBlob(doc, calc), csvFileName(doc.issueDate || todayIso()))
  })
  $('save-doc').addEventListener('click', () => {
    readForm()
    doc.updatedAt = new Date().toISOString()
    const copy = structuredClone(doc)
    const idx = data.docs.findIndex((x) => x.id === copy.id)
    if (idx >= 0) data.docs[idx] = copy
    else data.docs.push(copy)
    const ok = persist()
    renderSavedList()
    setStatus(ok ? '保存しました。' : '保存できませんでした（ブラウザの保存領域が使えません）。バックアップ（JSON）をご利用ください。')
  })
  $('new-doc').addEventListener('click', () => {
    readForm()
    doc = emptyDoc()
    writeForm()
    refresh()
    persist()
    setStatus('新しい書類を開始しました。')
  })
  $('copy-doc').addEventListener('click', () => {
    readForm()
    doc = { ...structuredClone(doc), id: newId(), number: '', issueDate: todayIso(), updatedAt: new Date().toISOString() }
    writeForm()
    refresh()
    persist()
    setStatus('複製しました。書類番号と日付を確認してください。')
  })
  $('export-json').addEventListener('click', () => {
    readForm()
    data.draft = doc
    download(new Blob([serializeAppData(data)], { type: 'application/json;charset=utf-8' }), jsonFileName(todayIso()))
  })
  $('import-json').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5_000_000) {
      setStatus('ファイルが大きすぎます（5MBまで）。')
      return
    }
    const parsed = parseImportedJson(await file.text())
    input.value = ''
    if (!parsed) {
      setStatus('読み込めませんでした。このツールで保存したJSONファイルを選んでください。')
      return
    }
    if (!window.confirm('現在の保存データを、読み込んだ内容で置き換えます。よろしいですか？')) return
    data.issuer = parsed.issuer ?? emptyIssuer()
    data.docs = parsed.docs
    doc = parsed.draft ?? emptyDoc()
    writeForm()
    refresh()
    persist()
    renderSavedList()
    setStatus(`読み込みました（保存済み書類 ${parsed.docs.length} 件）。`)
  })
}

buildShell()
writeForm()
bind()
refresh()
renderSavedList()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // 登録に失敗しても通常のオンライン利用には影響しない
  })
}
