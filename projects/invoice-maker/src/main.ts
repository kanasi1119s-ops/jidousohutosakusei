import './style.css'
import {
  calculate,
  formatYen,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumber,
  TAX_RATES,
  type TaxRate,
} from './calc'
import { buildInvoiceListCsvBlob, csvFileName, jsonFileName } from './csv'
import {
  checkRequirements,
  emptyLine,
  LIMITS,
  newId,
  newInvoice,
  parseAppData,
  type AppData,
  type Invoice,
} from './invoice'
import { dataToJsonBlob, loadData, saveData } from './storage'

type El = HTMLElement

let data: AppData = loadData()

function currentInvoice(): Invoice {
  return data.invoices.find((i) => i.id === data.currentId) ?? data.invoices[0]
}

/** DOM を安全に組み立てる（ユーザー入力は常に textContent 経由。innerHTML は使わない）。 */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string } = {},
  children: (El | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props.class) el.className = props.class
  if (props.text !== undefined) el.textContent = props.text
  for (const c of children) el.append(c)
  return el
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el
}

function setStatus(message: string, isError = false): void {
  const el = $('status')
  el.textContent = message
  el.classList.toggle('error', isError)
}

function persist(): void {
  if (!saveData(data)) {
    setStatus('ブラウザに保存できませんでした。バックアップ（JSON）を保存してください。', true)
  }
}

// ---- フォームと状態の同期 ----

function getBound(path: string): string | boolean {
  const [scope, key] = path.split('.')
  const obj = (scope === 'issuer' ? data.issuer : currentInvoice()) as unknown as Record<string, unknown>
  return obj[key] as string | boolean
}

function setBound(path: string, value: string | boolean): void {
  const [scope, key] = path.split('.')
  const obj = (scope === 'issuer' ? data.issuer : currentInvoice()) as unknown as Record<string, unknown>
  obj[key] = value
}

function bindFields(): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-bind]').forEach((el) => {
    const path = el.dataset.bind!
    const handler = () => {
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        setBound(path, el.checked)
      } else {
        setBound(path, el.value)
      }
      persist()
      if (path === 'invoice.number' || path === 'invoice.recipient') renderInvoiceSelect()
      refreshDerived()
    }
    el.addEventListener('input', handler)
    el.addEventListener('change', handler)
  })

  // 登録番号は全角・小文字の入力ゆれをフォーカスが外れたときに整える
  const reg = $('issuer-reg') as HTMLInputElement
  reg.addEventListener('change', () => {
    reg.value = normalizeRegistrationNumber(reg.value)
    data.issuer.registrationNumber = reg.value
    persist()
    refreshDerived()
  })
}

function fillFields(): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-bind]').forEach((el) => {
    const v = getBound(el.dataset.bind!)
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.checked = v === true
    } else {
      el.value = typeof v === 'string' ? v : ''
    }
  })
}

// ---- 請求書の選択・追加・削除 ----

function invoiceLabel(inv: Invoice): string {
  const who = inv.recipient.trim() || '(宛名未入力)'
  return `${inv.number || '(番号なし)'} / ${who}`
}

function renderInvoiceSelect(): void {
  const select = $('invoice-select') as HTMLSelectElement
  select.replaceChildren(
    ...data.invoices.map((inv) => {
      const opt = document.createElement('option')
      opt.value = inv.id
      opt.textContent = invoiceLabel(inv)
      return opt
    }),
  )
  select.value = data.currentId
}

function switchInvoice(id: string): void {
  data.currentId = id
  persist()
  renderAll()
}

// ---- 明細テーブル ----

function lineInput(
  label: string,
  value: string,
  onInput: (v: string) => void,
  opts: { numeric?: boolean; onCommit?: (input: HTMLInputElement) => void } = {},
): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  input.autocomplete = 'off'
  input.setAttribute('aria-label', label)
  if (opts.numeric) input.inputMode = 'decimal'
  input.addEventListener('input', () => onInput(input.value))
  if (opts.onCommit) input.addEventListener('change', () => opts.onCommit!(input))
  return input
}

function renderLines(): void {
  const inv = currentInvoice()
  const body = $('lines-body')
  body.replaceChildren(
    ...inv.lines.map((line, index) => {
      const n = index + 1
      const amountCell = h('td', { class: 'amount', text: '' })
      amountCell.dataset.lineAmount = String(index)

      const rate = document.createElement('select')
      rate.setAttribute('aria-label', `明細${n}の税率`)
      for (const r of TAX_RATES) {
        const opt = document.createElement('option')
        opt.value = String(r)
        opt.textContent = r === 0 ? '非課税等' : r === 8 ? '8%軽減' : '10%'
        rate.append(opt)
      }
      rate.value = String(line.taxRate)
      rate.addEventListener('change', () => {
        line.taxRate = Number(rate.value) as TaxRate
        persist()
        refreshDerived()
      })

      const remove = h('button', { text: '削除' })
      remove.type = 'button'
      remove.className = 'danger small'
      remove.setAttribute('aria-label', `明細${n}を削除`)
      remove.addEventListener('click', () => {
        inv.lines.splice(index, 1)
        if (inv.lines.length === 0) inv.lines.push(emptyLine())
        persist()
        renderLines()
        refreshDerived()
      })

      const numberCommit = (key: 'quantity' | 'unitPrice') => (input: HTMLInputElement) => {
        input.value = String(line[key])
      }

      const tr = h('tr', {}, [
        h('td', {}, [
          lineInput(`明細${n}の品名`, line.name, (v) => {
            line.name = v.slice(0, LIMITS.maxText)
            persist()
            refreshDerived()
          }),
        ]),
        h('td', { class: 'num' }, [
          lineInput(
            `明細${n}の数量`,
            String(line.quantity),
            (v) => {
              line.quantity = Math.max(-1e6, Math.min(1e6, parseNumber(v)))
              persist()
              refreshDerived()
            },
            { numeric: true, onCommit: numberCommit('quantity') },
          ),
        ]),
        h('td', { class: 'unit' }, [
          lineInput(`明細${n}の単位`, line.unit, (v) => {
            line.unit = v.slice(0, 20)
            persist()
            refreshDerived()
          }),
        ]),
        h('td', { class: 'num' }, [
          lineInput(
            `明細${n}の単価`,
            String(line.unitPrice),
            (v) => {
              line.unitPrice = Math.max(-1e8, Math.min(1e8, parseNumber(v)))
              persist()
              refreshDerived()
            },
            { numeric: true, onCommit: numberCommit('unitPrice') },
          ),
        ]),
        h('td', {}, [rate]),
        amountCell,
        h('td', {}, [remove]),
      ])
      return tr
    }),
  )
}

// ---- プレビュー・チェック ----

function dateJa(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

function honorific(name: string): string {
  const t = name.trim()
  if (t === '') return ''
  return /(御中|様|殿)$/.test(t) ? t : t + ' 御中'
}

function renderPreview(): void {
  const inv = currentInvoice()
  const issuer = data.issuer
  const result = calculate(inv)
  const sheet = $('invoice-preview')
  const inclusive = inv.priceMode === 'inclusive'
  const hasReduced = inv.lines.some((l) => l.taxRate === 8 && l.name.trim() !== '')
  const shown = inv.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.name.trim() !== '')

  const metaRow = (label: string, value: string) =>
    h('div', { class: 'meta-row' }, [h('dt', { text: label }), h('dd', { text: value })])

  const issuerBlock = h('div', { class: 'issuer-block' }, [
    h('p', { class: 'issuer-name', text: issuer.name }),
    h('p', { text: issuer.address }),
    h('p', { text: issuer.contact }),
    h('p', { text: issuer.registrationNumber ? `登録番号: ${issuer.registrationNumber}` : '' }),
  ])

  const itemsTable = h('table', { class: 'items' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { text: '品名' }),
        h('th', { class: 'num', text: '数量' }),
        h('th', { class: 'num', text: '単価' }),
        h('th', { class: 'num', text: '税率' }),
        h('th', { class: 'num', text: inclusive ? '金額（税込）' : '金額（税抜）' }),
      ]),
    ]),
    h(
      'tbody',
      {},
      shown.map(({ l, i }) =>
        h('tr', {}, [
          h('td', { text: (l.taxRate === 8 ? '※ ' : '') + l.name }),
          h('td', { class: 'num', text: `${l.quantity.toLocaleString('ja-JP')}${l.unit}` }),
          h('td', { class: 'num', text: formatYen(l.unitPrice) }),
          h('td', { class: 'num', text: l.taxRate === 0 ? '非課税等' : `${l.taxRate}%` }),
          h('td', { class: 'num', text: formatYen(result.lineAmounts[i]) }),
        ]),
      ),
    ),
  ])

  const breakdownRows = result.perRate
    .filter((r) => r.rate !== 0 || r.gross !== 0)
    .map((r) =>
      h('tr', {}, [
        h('td', { text: r.rate === 0 ? '非課税・不課税' : `${r.rate}%対象${r.rate === 8 ? '（軽減税率）' : ''}` }),
        h('td', { class: 'num', text: formatYen(r.net) }),
        h('td', { class: 'num', text: r.rate === 0 ? '-' : formatYen(r.tax) }),
        h('td', { class: 'num', text: formatYen(r.total) }),
      ]),
    )
  const breakdown = h('table', { class: 'breakdown' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { text: '税率別内訳' }),
        h('th', { class: 'num', text: '対価（税抜）' }),
        h('th', { class: 'num', text: '消費税額' }),
        h('th', { class: 'num', text: '税込合計' }),
      ]),
    ]),
    h('tbody', {}, breakdownRows),
  ])

  const totals = h('dl', { class: 'totals' }, [
    metaRow('小計（税抜）', formatYen(result.net)),
    metaRow('消費税', formatYen(result.tax)),
    metaRow('合計（税込）', formatYen(result.total)),
  ])
  if (inv.withholding) {
    totals.append(metaRow('源泉徴収税額', '-' + formatYen(result.withholdingAmount)))
  }

  const children: El[] = [
    h('h2', { class: 'doc-title', text: '請求書' }),
    h('div', { class: 'head-grid' }, [
      h('div', {}, [
        h('p', { class: 'recipient', text: honorific(inv.recipient) }),
        h('p', { class: 'subject', text: inv.subject ? `件名: ${inv.subject}` : '' }),
      ]),
      h('dl', { class: 'meta' }, [
        metaRow('請求書番号', inv.number),
        metaRow('発行日', dateJa(inv.issueDate)),
      ]),
    ]),
    issuerBlock,
    h('div', { class: 'grand' }, [
      h('span', { text: inv.withholding ? 'ご請求額（源泉徴収後）' : 'ご請求額（税込）' }),
      h('strong', { class: 'grand-amount', text: formatYen(result.payable) }),
    ]),
    h('p', { class: 'due', text: inv.dueDate ? `お支払期限: ${dateJa(inv.dueDate)}` : '' }),
    itemsTable,
  ]
  if (hasReduced) children.push(h('p', { class: 'small-note', text: '※ は軽減税率（8%）の対象品目です。' }))
  children.push(breakdown, totals)
  if (issuer.bank.trim()) {
    children.push(h('div', { class: 'block' }, [h('h3', { text: '振込先' }), h('p', { class: 'pre', text: issuer.bank })]))
  }
  if (inv.notes.trim()) {
    children.push(h('div', { class: 'block' }, [h('h3', { text: '備考' }), h('p', { class: 'pre', text: inv.notes })]))
  }
  sheet.replaceChildren(...children)
}

function renderChecks(): void {
  const items = checkRequirements(data.issuer, currentInvoice())
  $('check-list').replaceChildren(
    ...items.map((item) => {
      const li = h('li', { class: item.ok ? 'ok' : 'ng' }, [
        h('span', { class: 'mark', text: item.ok ? '✔ OK' : '✖ 要確認' }),
        h('span', { class: 'label', text: ' ' + item.label }),
      ])
      if (item.hint && (!item.ok || item.info)) li.append(h('div', { class: 'hint', text: item.hint }))
      return li
    }),
  )
}

function renderRegMessage(): void {
  const v = data.issuer.registrationNumber
  const el = $('reg-message')
  if (v === '') {
    el.textContent = '免税事業者などで登録番号がない場合は空欄のままにしてください（インボイスとしては無効になります）。'
    el.classList.remove('error')
  } else if (isValidRegistrationNumber(normalizeRegistrationNumber(v))) {
    el.textContent = '形式は正しいです。有効性は国税庁の公表サイトで確認してください。'
    el.classList.remove('error')
  } else {
    el.textContent = '形式が正しくありません。「T」+数字13桁で入力してください。'
    el.classList.add('error')
  }
}

function renderAmounts(): void {
  const result = calculate(currentInvoice())
  document.querySelectorAll<HTMLElement>('[data-line-amount]').forEach((cell) => {
    cell.textContent = formatYen(result.lineAmounts[Number(cell.dataset.lineAmount)] ?? 0)
  })
}

/** 入力のたびに更新する派生表示（テーブル自体は再描画しない＝フォーカスを保つ） */
function refreshDerived(): void {
  renderAmounts()
  renderPreview()
  renderChecks()
  renderRegMessage()
}

function renderAll(): void {
  renderInvoiceSelect()
  fillFields()
  renderLines()
  refreshDerived()
}

// ---- ダウンロード / 読み込み ----

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function bindActions(): void {
  $('invoice-select').addEventListener('change', (e) => switchInvoice((e.target as HTMLSelectElement).value))

  $('new-invoice').addEventListener('click', () => {
    if (data.invoices.length >= LIMITS.maxInvoices) {
      setStatus(`請求書は最大${LIMITS.maxInvoices}件までです。`, true)
      return
    }
    const inv = newInvoice(data.invoices)
    data.invoices.push(inv)
    switchInvoice(inv.id)
    setStatus('新しい請求書を作成しました。')
  })

  $('duplicate-invoice').addEventListener('click', () => {
    if (data.invoices.length >= LIMITS.maxInvoices) {
      setStatus(`請求書は最大${LIMITS.maxInvoices}件までです。`, true)
      return
    }
    const src = currentInvoice()
    const copy: Invoice = JSON.parse(JSON.stringify(src))
    copy.id = newId()
    copy.number = newInvoice(data.invoices).number
    data.invoices.push(copy)
    switchInvoice(copy.id)
    setStatus('請求書を複製しました（請求書番号は自動で振り直しています）。')
  })

  $('delete-invoice').addEventListener('click', () => {
    const inv = currentInvoice()
    if (!window.confirm(`請求書「${invoiceLabel(inv)}」を削除します。元に戻せません。よろしいですか？`)) return
    data.invoices = data.invoices.filter((i) => i.id !== inv.id)
    if (data.invoices.length === 0) data.invoices.push(newInvoice([]))
    switchInvoice(data.invoices[0].id)
    setStatus('請求書を削除しました。')
  })

  $('add-line').addEventListener('click', () => {
    const inv = currentInvoice()
    if (inv.lines.length >= LIMITS.maxLines) {
      setStatus(`明細は最大${LIMITS.maxLines}行までです。`, true)
      return
    }
    inv.lines.push(emptyLine())
    persist()
    renderLines()
    refreshDerived()
  })

  $('print-invoice').addEventListener('click', () => window.print())

  $('export-csv').addEventListener('click', () => {
    download(buildInvoiceListCsvBlob(data.invoices), csvFileName())
    setStatus('請求書一覧をCSV（BOM付きUTF-8）で保存しました。')
  })

  $('export-json').addEventListener('click', () => {
    download(dataToJsonBlob(data), jsonFileName())
    setStatus('バックアップ（JSON）を保存しました。')
  })

  $('import-json').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > LIMITS.maxFileBytes) {
      setStatus('ファイルが大きすぎます（5MBまで）。', true)
      return
    }
    try {
      const imported = parseAppData(await file.text())
      data = imported
      persist()
      renderAll()
      setStatus(`バックアップを読み込みました（請求書${imported.invoices.length}件）。`)
    } catch (err) {
      setStatus(err instanceof Error ? `読み込みに失敗しました: ${err.message}` : '読み込みに失敗しました。', true)
    }
  })
}

/** 印刷（PDF保存）時の既定ファイル名は document.title になるため、半角英数字のみにする。 */
function bindPrintTitle(): void {
  const normalTitle = document.title
  window.addEventListener('beforeprint', () => {
    const safe = currentInvoice().number.replace(/[^A-Za-z0-9_-]/g, '')
    document.title = 'invoice-' + (safe || 'document')
  })
  window.addEventListener('afterprint', () => {
    document.title = normalTitle
  })
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // 登録に失敗してもオンラインでの利用には影響しない
      })
    })
  }
}

bindFields()
bindActions()
bindPrintTitle()
renderAll()
registerServiceWorker()
