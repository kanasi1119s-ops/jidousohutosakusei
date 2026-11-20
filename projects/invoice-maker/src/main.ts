import './style.css'
import { computeTotals, formatYen, normalizeRegNo, parseNumber, type Rounding, type TaxRate } from './calc'
import { buildInvoiceCsvBlob, csvFileName, safeFileName } from './csv'
import { buildBackup, emptyInvoice, parseBackup, sanitizeInvoice, validateInvoice, type Invoice, type SavedInvoice } from './model'
import { jsonBlob, loadCurrent, loadSaved, saveCurrent, writeSaved } from './storage'

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

let inv: Invoice = loadCurrent()
let saved: SavedInvoice[] = loadSaved()

const app = document.getElementById('app')!
const itemsBox = h('div', { id: 'items' })
const preview = h('article', { id: 'preview', 'aria-label': '請求書プレビュー' })
const warnings = h('ul', { id: 'warnings' })
const message = h('p', { id: 'message', role: 'status' })
const savedList = h('ul', { id: 'saved-list' })

function field(id: string, label: string, key: keyof Invoice, opts: { type?: string; textarea?: boolean; placeholder?: string } = {}) {
  const input = opts.textarea
    ? h('textarea', { id, rows: '2' })
    : h('input', { id, type: opts.type ?? 'text', autocomplete: 'off' })
  if (opts.placeholder) input.setAttribute('placeholder', opts.placeholder)
  ;(input as HTMLInputElement).value = String(inv[key] ?? '')
  input.addEventListener('input', () => {
    ;(inv as unknown as Record<string, unknown>)[key] = (input as HTMLInputElement).value
    changed()
  })
  return h('label', { class: 'field', for: id }, [h('span', {}, [label]), input])
}

function roundingSelect() {
  const sel = h('select', { id: 'rounding' })
  const opts: [Rounding, string][] = [['floor', '切り捨て'], ['round', '四捨五入'], ['ceil', '切り上げ']]
  for (const [v, l] of opts) {
    const o = h('option', { value: v }, [l])
    if (inv.rounding === v) o.selected = true
    sel.append(o)
  }
  sel.addEventListener('change', () => {
    inv.rounding = sel.value as Rounding
    changed()
  })
  return h('label', { class: 'field', for: 'rounding' }, [h('span', {}, ['消費税の端数処理（税率ごとに1回）']), sel])
}

function renderItems() {
  itemsBox.replaceChildren()
  inv.items.forEach((it, i) => {
    const desc = h('input', { type: 'text', class: 'it-desc', 'aria-label': `品名 ${i + 1}`, autocomplete: 'off' })
    desc.value = it.description
    desc.addEventListener('input', () => {
      it.description = desc.value
      changed()
    })
    const qty = h('input', { type: 'text', inputmode: 'decimal', class: 'it-qty', 'aria-label': `数量 ${i + 1}` })
    qty.value = String(it.quantity)
    const unit = h('input', { type: 'text', inputmode: 'decimal', class: 'it-unit', 'aria-label': `単価 ${i + 1}` })
    unit.value = String(it.unitPriceYen)
    const bind = (el: HTMLInputElement, set: (n: number) => void) =>
      el.addEventListener('input', () => {
        const n = parseNumber(el.value)
        el.classList.toggle('invalid', Number.isNaN(n))
        if (!Number.isNaN(n)) set(n)
        changed()
      })
    bind(qty, (n) => (it.quantity = n))
    bind(unit, (n) => (it.unitPriceYen = n))
    const rate = h('select', { class: 'it-rate', 'aria-label': `税率 ${i + 1}` })
    for (const r of [10, 8]) {
      const o = h('option', { value: String(r) }, [r === 8 ? '8%（軽減）' : '10%'])
      if (it.taxRate === r) o.selected = true
      rate.append(o)
    }
    rate.addEventListener('change', () => {
      it.taxRate = Number(rate.value) as TaxRate
      changed()
    })
    const del = h('button', { type: 'button', class: 'danger it-del', 'aria-label': `明細 ${i + 1} を削除` }, ['削除'])
    del.addEventListener('click', () => {
      inv.items.splice(i, 1)
      if (inv.items.length === 0) inv.items = emptyInvoice().items
      renderItems()
      changed()
    })
    itemsBox.append(h('div', { class: 'item-row' }, [desc, qty, unit, rate, del]))
  })
}

function renderPreview() {
  const t = computeTotals(inv.items, inv.rounding)
  const regNo = normalizeRegNo(inv.issuerRegNo)
  const tr = (cells: (string | Node)[], cls = '') => h('tr', cls ? { class: cls } : {}, cells.map((c) => h('td', {}, [c])))
  const rows = inv.items.map((it, i) =>
    tr([
      it.description + (it.taxRate === 8 ? ' ※' : ''),
      String(it.quantity),
      formatYen(it.unitPriceYen),
      `${it.taxRate}%`,
      formatYen(t.lineAmounts[i]),
    ]),
  )
  const body = h('tbody', {}, rows)
  const head = h('thead', {}, [h('tr', {}, ['品名', '数量', '単価', '税率', '金額(税抜)'].map((x) => h('th', {}, [x])))])
  const sums = h('table', { class: 'sums' }, [
    h('tbody', {}, [
      ...t.byRate.flatMap((r) => [
        tr([`${r.rate}%対象 小計(税抜)`, formatYen(r.subtotalYen)]),
        tr([`${r.rate}%対象 消費税額`, formatYen(r.taxYen)]),
      ]),
      tr(['合計(税込)', formatYen(t.totalYen)], 'grand'),
    ]),
  ])
  const hasReduced = inv.items.some((it) => it.taxRate === 8)
  preview.replaceChildren(
    h('h2', { class: 'doc-title' }, ['請求書']),
    h('div', { class: 'doc-meta' }, [
      h('div', {}, [h('p', { class: 'client' }, [(inv.clientName || '（宛名未入力）') + ' 御中'])]),
      h('div', {}, [
        h('p', {}, [`請求書番号: ${inv.invoiceNumber || '-'}`]),
        h('p', {}, [`発行日（取引年月日）: ${inv.issueDate || '-'}`]),
        h('p', {}, [`お支払期限: ${inv.dueDate || '-'}`]),
        h('p', { class: 'issuer' }, [inv.issuerName || '（発行者名未入力）']),
        h('p', {}, [`登録番号: ${regNo || '（未登録）'}`]),
        h('p', { class: 'pre' }, [inv.issuerAddress]),
      ]),
    ]),
    h('p', { class: 'grand-total' }, [`ご請求金額（税込）: ${formatYen(t.totalYen)}`]),
    h('table', { class: 'lines' }, [head, body]),
    ...(hasReduced ? [h('p', { class: 'small' }, ['※ は軽減税率（8%）対象'])] : []),
    sums,
    ...(inv.bankInfo ? [h('p', { class: 'pre' }, ['お振込先: ' + inv.bankInfo])] : []),
    ...(inv.note ? [h('p', { class: 'pre' }, ['備考: ' + inv.note])] : []),
  )
  warnings.replaceChildren(...validateInvoice(inv).map((w) => h('li', {}, [w])))
}

function changed() {
  saveCurrent(inv)
  renderPreview()
}

function say(text: string, isError = false) {
  message.textContent = text
  message.className = isError ? 'error' : 'ok'
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function renderSaved() {
  savedList.replaceChildren(
    ...saved.map((s, i) => {
      const load = h('button', { type: 'button', class: 'load' }, ['読み込む'])
      load.addEventListener('click', () => {
        inv = sanitizeInvoice(s.invoice)
        rebuildForm()
        say('保存した請求書を読み込みました。')
      })
      const del = h('button', { type: 'button', class: 'danger del' }, ['削除'])
      del.addEventListener('click', () => {
        saved.splice(i, 1)
        writeSaved(saved)
        renderSaved()
      })
      const label = `${s.invoice.invoiceNumber || '番号なし'} / ${s.invoice.clientName || '宛名なし'} / ${s.savedAt.slice(0, 10)}`
      return h('li', {}, [h('span', {}, [label]), load, del])
    }),
  )
  if (saved.length === 0) savedList.append(h('li', { class: 'muted' }, ['保存済みの請求書はありません。']))
}

const formBox = h('div', { id: 'form' })

function rebuildForm() {
  formBox.replaceChildren(
    h('h2', {}, ['発行者（あなた）']),
    field('issuerName', '氏名または名称', 'issuerName'),
    field('issuerRegNo', '適格請求書発行事業者の登録番号', 'issuerRegNo', { placeholder: 'T1234567890123' }),
    field('issuerAddress', '住所', 'issuerAddress', { textarea: true }),
    h('h2', {}, ['請求先・日付']),
    field('clientName', '宛名（受領者の氏名または名称）', 'clientName'),
    field('invoiceNumber', '請求書番号', 'invoiceNumber'),
    field('issueDate', '発行日（取引年月日）', 'issueDate', { type: 'date' }),
    field('dueDate', 'お支払期限', 'dueDate', { type: 'date' }),
    h('h2', {}, ['明細']),
    h('div', { class: 'item-head' }, ['品名', '数量', '単価(税抜)', '税率', ''].map((x) => h('span', {}, [x]))),
    itemsBox,
    (() => {
      const add = h('button', { type: 'button', id: 'add-item' }, ['＋ 明細を追加'])
      add.addEventListener('click', () => {
        inv.items.push({ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
        renderItems()
        changed()
      })
      return add
    })(),
    roundingSelect(),
    h('h2', {}, ['その他']),
    field('bankInfo', 'お振込先', 'bankInfo', { textarea: true }),
    field('note', '備考', 'note', { textarea: true }),
  )
  renderItems()
  changed()
}

function buildApp() {
  const btn = (id: string, label: string, cls = '') => h('button', { type: 'button', id, ...(cls ? { class: cls } : {}) }, [label])
  const printBtn = btn('print', 'PDFとして保存・印刷')
  printBtn.addEventListener('click', () => window.print())
  const csvBtn = btn('export-csv', '明細をCSVでダウンロード')
  csvBtn.addEventListener('click', () => download(buildInvoiceCsvBlob(inv), csvFileName(inv)))
  const saveBtn = btn('save-invoice', 'この請求書を保存')
  saveBtn.addEventListener('click', () => {
    saved.unshift({ id: String(Date.now()), savedAt: new Date().toISOString(), invoice: structuredClone(inv) })
    writeSaved(saved)
    renderSaved()
    say('請求書を保存しました（このブラウザ内のみ）。')
  })
  const newBtn = btn('new-invoice', '新しい請求書')
  newBtn.addEventListener('click', () => {
    // 発行者情報は引き継ぐ
    const base = emptyInvoice()
    inv = { ...base, issuerName: inv.issuerName, issuerRegNo: inv.issuerRegNo, issuerAddress: inv.issuerAddress, bankInfo: inv.bankInfo, rounding: inv.rounding }
    rebuildForm()
    say('発行者情報を引き継いで新しい請求書を開始しました。')
  })
  const expBtn = btn('export-json', 'バックアップ(JSON)を書き出す')
  expBtn.addEventListener('click', () =>
    download(jsonBlob(buildBackup(inv, saved)), safeFileName(`invoice-maker-backup-${new Date().toISOString().slice(0, 10)}`, 'json')),
  )
  const file = h('input', { type: 'file', id: 'import-file', accept: 'application/json,.json', class: 'visually-hidden' })
  const impBtn = btn('import-json', 'バックアップを読み込む')
  impBtn.addEventListener('click', () => file.click())
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) return
    try {
      if (f.size > 5_000_000) throw new Error('ファイルが大きすぎます（5MBまで）。')
      const b = parseBackup(await f.text())
      inv = b.current
      saved = b.saved
      writeSaved(saved)
      renderSaved()
      rebuildForm()
      say('バックアップを読み込みました。')
    } catch (e) {
      say(e instanceof Error ? e.message : '読み込みに失敗しました。', true)
    }
    file.value = ''
  })

  rebuildForm()
  renderSaved()

  app.append(
    h('header', { class: 'top' }, [
      h('h1', {}, ['インボイス請求書メーカー']),
      h('p', {}, ['登録不要・オフライン対応。入力データはこのブラウザの外に送信されません。']),
    ]),
    h('main', { class: 'layout' }, [
      h('section', { class: 'panel no-print' }, [
        formBox,
        h('h2', {}, ['保存・出力']),
        h('div', { class: 'actions' }, [printBtn, csvBtn, saveBtn, newBtn]),
        h('div', { class: 'actions' }, [expBtn, impBtn, file]),
        message,
        h('h2', {}, ['保存済みの請求書']),
        savedList,
      ]),
      h('section', { class: 'panel' }, [
        h('div', { class: 'no-print' }, [h('h2', {}, ['プレビュー']), h('p', { class: 'small' }, ['記載事項の確認']), warnings]),
        preview,
      ]),
    ]),
    h('footer', { class: 'no-print' }, [
      h('p', {}, [
        '本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。登録番号の実在確認は国税庁の適格請求書発行事業者公表サイトで行ってください。端数処理は「1請求書につき税率ごとに1回」を前提としています。最終的な記載内容の確認は発行者の責任で行ってください。',
      ]),
    ]),
  )
}

buildApp()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
