import './style.css'
import { calcTotals, formatYen, parseNumber, type LineItem, type RoundingMode, type TaxRate } from './calc'
import { emptyInvoice, parseInvoiceJson, validateInvoice, type Invoice } from './invoice'
import { buildInvoiceCsv, csvBlob, downloadName } from './csv'
import { loadAll, saveAll, upsert } from './storage'

const app = document.getElementById('app') as HTMLElement
const today = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

let inv: Invoice = emptyInvoice(today())
let saved: Invoice[] = loadAll()

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  const { class: cls, ...rest } = props as Record<string, unknown>
  if (cls) e.className = cls as string
  Object.assign(e, rest)
  children.forEach((c) => e.append(c))
  return e
}

function field(label: string, id: string, key: keyof Invoice, opts: { type?: string; area?: boolean; placeholder?: string } = {}) {
  const input = opts.area
    ? el('textarea', { id, value: String(inv[key] ?? '') })
    : el('input', { id, type: opts.type ?? 'text', value: String(inv[key] ?? ''), placeholder: opts.placeholder ?? '' })
  input.addEventListener('input', () => {
    ;(inv as unknown as Record<string, unknown>)[key] = input.value
    renderPreview()
  })
  return el('label', {}, label, input)
}

function renderItems(box: HTMLElement) {
  box.replaceChildren()
  inv.items.forEach((it, i) => {
    const mk = (cls: string, label: string, value: string, onChange: (v: string) => void) => {
      const input = el('input', { value, type: 'text', id: `item-${i}-${cls}` })
      input.inputMode = cls === 'name' ? 'text' : 'decimal'
      input.addEventListener('input', () => {
        onChange(input.value)
        renderPreview()
      })
      return el('label', { class: cls }, label, input)
    }
    const rate = el('select', { id: `item-${i}-rate` })
    ;[10, 8].forEach((r) => rate.append(el('option', { value: String(r), selected: it.taxRate === r }, `${r}%`)))
    rate.addEventListener('change', () => {
      it.taxRate = Number(rate.value) as TaxRate
      renderPreview()
    })
    const del = el('button', { type: 'button', class: 'sub', id: `item-${i}-del` }, '削除')
    del.addEventListener('click', () => {
      inv.items.splice(i, 1)
      renderItems(box)
      renderPreview()
    })
    box.append(
      el(
        'div',
        { class: 'item' },
        mk('name', '品名', it.name, (v) => (it.name = v)),
        mk('qty', '数量', String(it.quantity), (v) => (it.quantity = parseNumber(v))),
        mk('price', '単価(税抜)', String(it.unitPrice), (v) => (it.unitPrice = parseNumber(v))),
        el('label', {}, '税率', rate),
        del,
      ),
    )
  })
}

const preview = el('div', { class: 'paper', id: 'preview' })
const errorsEl = el('ul', { id: 'errors' })
const messageEl = el('p', { id: 'message', role: 'status' })
const savedEl = el('ul', { class: 'saved', id: 'saved-list' })

function say(msg: string) {
  messageEl.textContent = msg
}

function renderPreview() {
  const t = calcTotals(inv.items, inv.rounding)
  const errs = validateInvoice(inv)
  errorsEl.replaceChildren(...errs.map((e) => el('li', {}, e)))

  const head = el('div', {})
  head.append(
    el('h2', {}, '請求書'),
    el('p', {}, `請求書番号: ${inv.invoiceNo}　発行日: ${inv.issueDate}　お支払期限: ${inv.dueDate}`),
    el('p', { id: 'pv-client' }, `${inv.clientName} 御中`),
    el('p', { class: 'pre' }, `${inv.issuerName}\n登録番号: ${inv.issuerRegNo}\n${inv.issuerAddress}\n${inv.issuerContact}`),
  )
  const table = el('table', {})
  table.append(el('thead', {}, el('tr', {}, ...['品名', '数量', '単価', '税率', '金額(税抜)'].map((h) => el('th', {}, h)))))
  const tb = el('tbody', {})
  inv.items.forEach((it, i) => {
    tb.append(
      el(
        'tr',
        {},
        el('td', {}, it.name),
        el('td', { class: 'num' }, Number.isFinite(it.quantity) ? String(it.quantity) : ''),
        el('td', { class: 'num' }, formatYen(it.unitPrice || 0)),
        el('td', { class: 'num' }, `${it.taxRate}%`),
        el('td', { class: 'num' }, formatYen(t.lineAmounts[i] || 0)),
      ),
    )
  })
  table.append(tb)
  const sum = el('table', {})
  t.byRate.forEach((r) =>
    sum.append(
      el(
        'tr',
        {},
        el('td', {}, `${r.taxRate}%対象`),
        el('td', { class: 'num' }, formatYen(r.subtotal)),
        el('td', {}, `消費税(${r.taxRate}%)`),
        el('td', { class: 'num' }, formatYen(r.tax)),
      ),
    ),
  )
  preview.replaceChildren(
    head,
    table,
    sum,
    el('p', { class: 'total', id: 'pv-total' }, `合計(税込): ${formatYen(t.total)}`),
    el('p', { class: 'pre' }, inv.bankInfo ? `お振込先:\n${inv.bankInfo}` : ''),
    el('p', { class: 'pre' }, inv.notes),
  )
}

function renderSaved() {
  savedEl.replaceChildren(
    ...saved.map((s) => {
      const open = el('button', { type: 'button', class: 'sub' }, '開く')
      open.addEventListener('click', () => {
        inv = structuredClone(s)
        build()
        say('保存済みの請求書を開きました')
      })
      const del = el('button', { type: 'button', class: 'sub' }, '削除')
      del.addEventListener('click', () => {
        saved = saved.filter((x) => x.id !== s.id)
        saveAll(saved)
        renderSaved()
      })
      return el('li', {}, el('span', {}, `${s.invoiceNo || '(番号なし)'} ${s.clientName}`), open, del)
    }),
  )
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function button(label: string, id: string, onClick: () => void, sub = false) {
  const b = el('button', { type: 'button', id, class: sub ? 'sub' : '' }, label)
  b.addEventListener('click', onClick)
  return b
}

function build() {
  const itemsBox = el('div', { id: 'items' })
  renderItems(itemsBox)

  const rounding = el('select', { id: 'rounding' })
  ;(
    [
      ['floor', '切り捨て'],
      ['round', '四捨五入'],
      ['ceil', '切り上げ'],
    ] as [RoundingMode, string][]
  ).forEach(([v, l]) => rounding.append(el('option', { value: v, selected: inv.rounding === v }, l)))
  rounding.addEventListener('change', () => {
    inv.rounding = rounding.value as RoundingMode
    renderPreview()
  })

  const importInput = el('input', { type: 'file', id: 'import-file', accept: '.json,application/json' })
  importInput.addEventListener('change', async () => {
    const f = importInput.files?.[0]
    if (!f) return
    try {
      const list = parseInvoiceJson(await f.text())
      list.forEach((x) => (saved = upsert(saved, x)))
      saveAll(saved)
      inv = structuredClone(list[0])
      build()
      say(`${list.length}件をインポートしました`)
    } catch (e) {
      say('インポートに失敗しました: ' + (e as Error).message)
    }
    importInput.value = ''
  })

  const form = el(
    'div',
    { class: 'card', id: 'form-col' },
    el('h2', {}, '発行者'),
    field('氏名または名称', 'issuerName', 'issuerName'),
    field('登録番号（T+13桁）', 'issuerRegNo', 'issuerRegNo', { placeholder: 'T1234567890123' }),
    field('住所', 'issuerAddress', 'issuerAddress', { area: true }),
    field('連絡先', 'issuerContact', 'issuerContact'),
    el('h2', {}, '請求内容'),
    field('宛名（取引先）', 'clientName', 'clientName'),
    el('div', { class: 'row' }, field('請求書番号', 'invoiceNo', 'invoiceNo'), field('発行日', 'issueDate', 'issueDate', { type: 'date' })),
    field('お支払期限', 'dueDate', 'dueDate', { type: 'date' }),
    el('h2', {}, '明細'),
    itemsBox,
    el(
      'div',
      { class: 'actions' },
      button(
        '明細を追加',
        'add-item',
        () => {
          inv.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 } as LineItem)
          renderItems(itemsBox)
          renderPreview()
        },
        true,
      ),
    ),
    el('label', {}, '消費税の端数処理（税率ごとに1回）', rounding),
    field('お振込先', 'bankInfo', 'bankInfo', { area: true }),
    field('備考', 'notes', 'notes', { area: true }),
  )

  const side = el(
    'div',
    {},
    el('div', { class: 'card no-print' }, errorsEl, messageEl,
      el(
        'div',
        { class: 'actions' },
        button('保存', 'save', () => {
          saved = upsert(saved, structuredClone(inv))
          say(saveAll(saved) ? 'このブラウザに保存しました' : '保存に失敗しました（ブラウザの保存領域が使えません）')
          renderSaved()
        }),
        button('印刷 / PDF保存', 'print', () => window.print()),
        button('CSV', 'export-csv', () => download(csvBlob(buildInvoiceCsv(inv)), downloadName('invoice', 'csv')), true),
        button(
          'JSONバックアップ',
          'export-json',
          () =>
            download(
              new Blob([JSON.stringify(saved.length ? saved : [inv], null, 2)], { type: 'application/json;charset=utf-8' }),
              downloadName('invoice-backup', 'json'),
            ),
          true,
        ),
        button('新規作成', 'new', () => {
          inv = emptyInvoice(today())
          build()
        }, true),
      ),
      el('label', {}, 'JSONインポート', importInput),
      el('h2', {}, '保存済み'),
      savedEl,
    ),
    preview,
  )

  app.replaceChildren(
    el('header', {}, el('h1', {}, 'インボイス対応 請求書ジェネレーター'),
      el('p', { class: 'badges' }, '登録不要 / オフライン対応 / 入力データはこのブラウザの外に送信されません')),
    el('main', {}, el('div', { class: 'layout' }, form, side)),
    el('footer', { class: 'note' },
      '本ツールは請求書作成の補助です。記載内容・税額の最終確認は発行者自身が行い、税務上の判断は税理士等の専門家にご相談ください。' +
        '適格請求書の記載事項は国税庁の公表資料をご確認ください。データはブラウザ内に保存されるため、定期的にJSONバックアップを取得してください。'),
  )
  renderPreview()
  renderSaved()
}

build()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
