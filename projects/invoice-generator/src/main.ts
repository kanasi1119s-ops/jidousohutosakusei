import './style.css'
import {
  MAX_ITEMS,
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
  computeInvoice,
  emptyItem,
  formatJaDate,
  formatYen,
  isValidRegistrationNo,
  newInvoice,
  normalizeRegistrationNo,
  parseNumberInput,
  type Invoice,
  type Rounding,
} from './calc'
import { buildInvoiceCsvBlob, safeFileStem } from './csv'
import {
  backupToBlob,
  buildBackup,
  loadDraft,
  loadSaved,
  parseBackupText,
  persistSaved,
  saveDraft,
  sanitizeInvoice,
  type SavedInvoice,
} from './storage'

type Child = Node | string | null | undefined
type Attrs = Record<string, string | boolean | ((e: Event) => void)>

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v)
    else if (typeof v === 'boolean') {
      if (v) el.setAttribute(k, '')
    } else el.setAttribute(k, v)
  }
  for (const c of children) {
    if (c === null || c === undefined) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

let invoice: Invoice = loadDraft() ?? newInvoice()
let saved: SavedInvoice[] = loadSaved()
let currentId: string | null = null

const previewEl = h('section', { class: 'preview', id: 'preview', 'aria-label': '請求書プレビュー' })
const itemsBody = h('div', { class: 'items', id: 'items' })
const messageEl = h('p', { class: 'message', id: 'message', role: 'status' })
const savedListEl = h('ul', { class: 'saved-list', id: 'saved-list' })
const regWarnEl = h('p', { class: 'warn', id: 'reg-warn' })
let formEl: HTMLElement

function say(text: string, isError = false): void {
  messageEl.textContent = text
  messageEl.className = isError ? 'message error' : 'message'
}

function changed(): void {
  saveDraft(invoice)
  renderPreview()
  updateRegWarning()
}

function updateRegWarning(): void {
  const no = invoice.issuerRegistrationNo
  if (no === '') {
    regWarnEl.textContent =
      '登録番号が未入力です。適格請求書（インボイス）として発行するには、登録番号（T+13桁）の記載が必要です。'
  } else if (!isValidRegistrationNo(no)) {
    regWarnEl.textContent = '登録番号の形式が正しくありません（T+数字13桁）。'
  } else {
    regWarnEl.textContent = ''
  }
}

function field(
  label: string,
  key: 'issuerName' | 'issuerRegistrationNo' | 'issuerAddress' | 'issuerContact' | 'clientName' | 'invoiceNo' | 'issueDate' | 'dueDate',
  opts: { type?: string; placeholder?: string; id: string } 
): HTMLElement {
  const input = h('input', {
    id: opts.id,
    type: opts.type ?? 'text',
    value: invoice[key],
    placeholder: opts.placeholder ?? '',
    maxlength: '200',
    autocomplete: 'off',
  })
  input.addEventListener('input', () => {
    invoice[key] = input.value
    changed()
  })
  if (key === 'issuerRegistrationNo') {
    input.addEventListener('blur', () => {
      input.value = invoice.issuerRegistrationNo = normalizeRegistrationNo(input.value)
      changed()
    })
  }
  return h('label', { class: 'field', for: opts.id }, h('span', {}, label), input)
}

function textarea(
  label: string,
  key: 'bankInfo' | 'notes' | 'issuerAddress',
  id: string,
  placeholder: string,
  rows = 3,
): HTMLElement {
  const ta = h('textarea', { id, rows: String(rows), maxlength: '2000', placeholder })
  ta.value = invoice[key]
  ta.addEventListener('input', () => {
    invoice[key] = ta.value
    changed()
  })
  return h('label', { class: 'field', for: id }, h('span', {}, label), ta)
}

function renderItems(): void {
  itemsBody.replaceChildren()
  invoice.items.forEach((item, i) => {
    const desc = h('input', {
      type: 'text',
      value: item.description,
      placeholder: '品目（例: Webサイト制作費）',
      'aria-label': `品目 ${i + 1}`,
      maxlength: '200',
      class: 'item-desc',
    })
    desc.addEventListener('input', () => {
      item.description = desc.value
      changed()
    })

    const numInput = (
      label: string,
      value: number,
      max: number,
      min: number,
      apply: (n: number) => void,
    ) => {
      const el = h('input', {
        type: 'text',
        inputmode: 'decimal',
        value: String(value),
        'aria-label': `${label} ${i + 1}`,
        class: 'item-num',
      })
      el.addEventListener('input', () => {
        const n = parseNumberInput(el.value)
        const ok = n !== null && n <= max && n >= min
        el.classList.toggle('invalid', !ok)
        el.setAttribute('aria-invalid', ok ? 'false' : 'true')
        apply(ok ? n : 0)
        changed()
      })
      el.addEventListener('blur', () => {
        const n = parseNumberInput(el.value)
        if (n !== null && n <= max && n >= min) el.value = String(n)
      })
      return el
    }

    const qty = numInput('数量', item.quantity, MAX_QUANTITY, 0, (n) => (item.quantity = n))
    const price = numInput('単価', item.unitPriceYen, MAX_UNIT_PRICE, -MAX_UNIT_PRICE, (n) => (item.unitPriceYen = n))
    const rate = h(
      'select',
      { 'aria-label': `税率 ${i + 1}`, class: 'item-rate' },
      h('option', { value: '10' }, '10%'),
      h('option', { value: '8' }, '8%（軽減）'),
    )
    rate.value = String(item.taxRate)
    rate.addEventListener('change', () => {
      item.taxRate = rate.value === '8' ? 8 : 10
      changed()
    })
    const del = h(
      'button',
      {
        type: 'button',
        class: 'btn small danger',
        'aria-label': `明細 ${i + 1} を削除`,
        onclick: () => {
          invoice.items.splice(i, 1)
          if (invoice.items.length === 0) invoice.items.push(emptyItem())
          renderItems()
          changed()
        },
      },
      '削除',
    )
    itemsBody.append(
      h(
        'div',
        { class: 'item-row' },
        desc,
        h('div', { class: 'item-nums' }, h('label', {}, h('small', {}, '数量'), qty), h('label', {}, h('small', {}, '単価(円)'), price), h('label', {}, h('small', {}, '税率'), rate), del),
      ),
    )
  })
}

function td(text: string, cls = ''): HTMLElement {
  return h('td', cls ? { class: cls } : {}, text)
}

function renderPreview(): void {
  const r = computeInvoice(invoice)
  const hasReduced = invoice.items.some((it) => it.taxRate === 8)
  const client = invoice.clientName
    ? `${invoice.clientName}${invoice.honorific ? ' ' + invoice.honorific : ''}`
    : '（請求先を入力してください）'

  const rows = invoice.items.map((it, i) =>
    h(
      'tr',
      {},
      td((it.description || '（品目未入力）') + (it.taxRate === 8 ? ' ※' : '')),
      td(String(it.quantity), 'num'),
      td(formatYen(it.unitPriceYen), 'num'),
      td(`${it.taxRate}%`, 'num'),
      td(formatYen(r.lineAmounts[i]), 'num'),
    ),
  )

  const sumRows = r.summaries.flatMap((s) => [
    h('tr', {}, td(`${s.rate}%対象 小計（税抜）`), td(formatYen(s.subtotalYen), 'num')),
    h('tr', {}, td(`${s.rate}%対象 消費税額`), td(formatYen(s.taxYen), 'num')),
  ])

  const regNo = invoice.issuerRegistrationNo
  const parts: (Node | null)[] = [
    h('h2', { class: 'doc-title' }, '請求書'),
    h(
      'div',
      { class: 'doc-head' },
      h('div', { class: 'doc-client' }, h('p', { class: 'client-name' }, client), h('p', {}, '下記のとおりご請求申し上げます。')),
      h(
        'div',
        { class: 'doc-meta' },
        h('p', {}, `請求書番号: ${invoice.invoiceNo || '-'}`),
        h('p', {}, `発行日: ${formatJaDate(invoice.issueDate) || '-'}`),
        h('p', {}, `支払期限: ${formatJaDate(invoice.dueDate) || '-'}`),
      ),
    ),
    h(
      'div',
      { class: 'doc-issuer' },
      h('p', { class: 'issuer-name' }, invoice.issuerName || '（発行者名を入力してください）'),
      invoice.issuerAddress ? h('p', { class: 'pre' }, invoice.issuerAddress) : null,
      invoice.issuerContact ? h('p', {}, invoice.issuerContact) : null,
      regNo ? h('p', {}, `登録番号: ${regNo}`) : null,
    ),
    h('p', { class: 'grand' }, h('span', {}, 'ご請求額（税込）'), h('strong', { id: 'grand-total' }, formatYen(r.payableYen))),
    h('div', { class: 'table-wrap' }, h(
      'table',
      { class: 'doc-table' },
      h('thead', {}, h('tr', {}, h('th', {}, '品目'), h('th', { class: 'num' }, '数量'), h('th', { class: 'num' }, '単価'), h('th', { class: 'num' }, '税率'), h('th', { class: 'num' }, '金額（税抜）'))),
      h('tbody', {}, ...rows),
    )),
    hasReduced ? h('p', { class: 'small-note' }, '※は軽減税率（8%）対象の品目です。') : null,
    h('div', { class: 'table-wrap' }, h(
      'table',
      { class: 'doc-table sum' },
      h(
        'tbody',
        {},
        ...sumRows,
        h('tr', { class: 'strong' }, td('合計（税込）'), td(formatYen(r.totalYen), 'num')),
        invoice.withholding ? h('tr', {}, td('源泉徴収税額（控除）'), td('-' + formatYen(r.withholdingYen), 'num')) : null,
        invoice.withholding ? h('tr', { class: 'strong' }, td('差引ご請求額'), td(formatYen(r.payableYen), 'num')) : null,
      ),
    )),
    invoice.bankInfo ? h('div', { class: 'doc-block' }, h('h3', {}, 'お振込先'), h('p', { class: 'pre' }, invoice.bankInfo)) : null,
    invoice.notes ? h('div', { class: 'doc-block' }, h('h3', {}, '備考'), h('p', { class: 'pre' }, invoice.notes)) : null,
  ]
  previewEl.replaceChildren(...parts.filter((n): n is Node => n !== null))
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function rebuildForm(): void {
  const fresh = buildForm()
  formEl.replaceWith(fresh)
  formEl = fresh
  changed()
}

function renderSaved(): void {
  savedListEl.replaceChildren()
  if (saved.length === 0) {
    savedListEl.append(h('li', { class: 'empty' }, '保存した請求書はまだありません。'))
    return
  }
  for (const s of saved) {
    const title = `${s.invoice.invoiceNo || '(番号なし)'} / ${s.invoice.clientName || '(請求先なし)'} / ${formatJaDate(s.invoice.issueDate)}`
    savedListEl.append(
      h(
        'li',
        {},
        h('span', { class: 'saved-title' }, title),
        h('button', { type: 'button', class: 'btn small', onclick: () => {
          invoice = sanitizeInvoice(s.invoice)
          currentId = s.id
          rebuildForm()
          say('保存済みの請求書を読み込みました。')
        } }, '読み込み'),
        h('button', { type: 'button', class: 'btn small danger', 'aria-label': `${title} を削除`, onclick: () => {
          saved = saved.filter((x) => x.id !== s.id)
          if (currentId === s.id) currentId = null
          persistSaved(saved)
          renderSaved()
          say('削除しました。')
        } }, '削除'),
      ),
    )
  }
}

function buildForm(): HTMLElement {
  const roundingSel = h(
    'select',
    { id: 'rounding' },
    h('option', { value: 'floor' }, '切り捨て'),
    h('option', { value: 'round' }, '四捨五入'),
    h('option', { value: 'ceil' }, '切り上げ'),
  )
  roundingSel.value = invoice.rounding
  roundingSel.addEventListener('change', () => {
    invoice.rounding = roundingSel.value as Rounding
    changed()
  })

  const honor = h(
    'select',
    { id: 'honorific' },
    h('option', { value: '御中' }, '御中'),
    h('option', { value: '様' }, '様'),
    h('option', { value: '' }, '敬称なし'),
  )
  honor.value = invoice.honorific
  honor.addEventListener('change', () => {
    invoice.honorific = honor.value as Invoice['honorific']
    changed()
  })

  const wh = h('input', { type: 'checkbox', id: 'withholding' })
  wh.checked = invoice.withholding
  wh.addEventListener('change', () => {
    invoice.withholding = wh.checked
    changed()
  })

  renderItems()

  return h(
    'div',
    { class: 'form', id: 'form' },
    h('fieldset', {}, h('legend', {}, '発行者（あなた）'),
      field('氏名・屋号・会社名', 'issuerName', { id: 'issuerName', placeholder: '例: 山田デザイン事務所' }),
      field('適格請求書発行事業者の登録番号', 'issuerRegistrationNo', { id: 'issuerRegistrationNo', placeholder: 'T1234567890123' }),
      regWarnEl,
      textarea('住所', 'issuerAddress', 'issuerAddress', '例: 東京都○○区1-2-3', 2),
      field('連絡先（電話・メール）', 'issuerContact', { id: 'issuerContact' }),
    ),
    h('fieldset', {}, h('legend', {}, '請求先'),
      h('div', { class: 'row' }, field('請求先名', 'clientName', { id: 'clientName', placeholder: '例: 株式会社サンプル' }), h('label', { class: 'field narrow', for: 'honorific' }, h('span', {}, '敬称'), honor)),
    ),
    h('fieldset', {}, h('legend', {}, '請求書情報'),
      h('div', { class: 'row' }, field('請求書番号', 'invoiceNo', { id: 'invoiceNo', placeholder: '例: 2026-001' }), field('発行日', 'issueDate', { id: 'issueDate', type: 'date' }), field('支払期限', 'dueDate', { id: 'dueDate', type: 'date' })),
    ),
    h('fieldset', {}, h('legend', {}, '明細'),
      itemsBody,
      h('button', { type: 'button', class: 'btn', id: 'add-item', onclick: () => {
        if (invoice.items.length >= MAX_ITEMS) { say(`明細は最大${MAX_ITEMS}行までです。`, true); return }
        invoice.items.push(emptyItem())
        renderItems()
        changed()
      } }, '＋ 明細を追加'),
      h('div', { class: 'row options' },
        h('label', { class: 'field narrow', for: 'rounding' }, h('span', {}, '消費税の端数処理'), roundingSel),
        h('label', { class: 'check' }, wh, h('span', {}, '報酬の源泉徴収を差し引く（目安）')),
      ),
      h('p', { class: 'hint' }, '消費税は「税率ごとの税抜合計」に対して1請求書につき1回だけ端数処理します。源泉徴収は税抜の報酬額を基準に計算する目安であり、対象となる報酬かどうかはご自身でご確認ください。'),
    ),
    h('fieldset', {}, h('legend', {}, '振込先・備考'),
      textarea('お振込先', 'bankInfo', 'bankInfo', '例: ○○銀行 △△支店 普通 1234567 ヤマダタロウ'),
      textarea('備考', 'notes', 'notes', '例: 振込手数料はご負担ください。'),
    ),
  )
}

function init(): void {
  const app = document.getElementById('app')!
  formEl = buildForm()

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'visually-hidden', 'aria-label': 'バックアップファイルを選択' })
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      const backup = parseBackupText(await file.text())
      invoice = backup.draft
      saved = backup.saved
      currentId = null
      persistSaved(saved)
      renderSaved()
      rebuildForm()
      say(`バックアップを読み込みました（保存済み ${saved.length} 件）。`)
    } catch (e) {
      say(e instanceof Error ? e.message : '読み込みに失敗しました。', true)
    }
    importInput.value = ''
  })

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('button', { type: 'button', class: 'btn primary', id: 'print', onclick: () => window.print() }, '印刷 / PDFで保存'),
    h('button', { type: 'button', class: 'btn', id: 'save', onclick: () => {
      const entry: SavedInvoice = { id: currentId ?? String(Date.now()), savedAt: new Date().toISOString(), invoice: structuredClone(invoice) }
      const idx = saved.findIndex((s) => s.id === entry.id)
      if (idx >= 0) saved[idx] = entry
      else saved.unshift(entry)
      currentId = entry.id
      persistSaved(saved)
      renderSaved()
      say('この請求書を保存しました（このブラウザ内のみ）。')
    } }, '保存'),
    h('button', { type: 'button', class: 'btn', id: 'new', onclick: () => {
      const keep = invoice
      invoice = { ...newInvoice(), issuerName: keep.issuerName, issuerRegistrationNo: keep.issuerRegistrationNo, issuerAddress: keep.issuerAddress, issuerContact: keep.issuerContact, bankInfo: keep.bankInfo, rounding: keep.rounding, withholding: keep.withholding }
      currentId = null
      rebuildForm()
      say('発行者情報を引き継いで新しい請求書を作成しました。')
    } }, '新規作成'),
    h('button', { type: 'button', class: 'btn', id: 'export-csv', onclick: () => download(buildInvoiceCsvBlob(invoice), safeFileStem(invoice.invoiceNo, invoice.issueDate) + '.csv') }, '明細CSV'),
    h('button', { type: 'button', class: 'btn', id: 'export-json', onclick: () => download(backupToBlob(buildBackup(invoice, saved)), `invoice-backup-${invoice.issueDate || 'undated'}.json`) }, 'バックアップ保存(JSON)'),
    h('button', { type: 'button', class: 'btn', id: 'import-btn', onclick: () => importInput.click() }, 'バックアップ読込'),
    importInput,
  )

  app.append(
    h('header', { class: 'site-header' },
      h('h1', {}, '請求書ジェネレーター'),
      h('p', { class: 'lead' }, 'インボイス（適格請求書）の記載事項に対応。登録不要・オフラインでも使え、入力内容はこのブラウザの外へ送信されません。'),
    ),
    toolbar,
    messageEl,
    h('main', { class: 'layout' },
      formEl,
      h('div', { class: 'right' },
        previewEl,
        h('section', { class: 'saved' }, h('h2', {}, '保存した請求書'), savedListEl),
      ),
    ),
    h('footer', { class: 'site-footer' },
      h('p', {}, '本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。インボイス制度・源泉徴収・消費税の取扱いは国税庁の公表資料または税理士にご確認ください。'),
      h('p', {}, 'データはこのブラウザ内（localStorage）にのみ保存されます。ブラウザのデータ消去で失われるため、「バックアップ保存(JSON)」で定期的に控えを取ってください。'),
    ),
  )
  renderSaved()
  changed()

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
}

init()
