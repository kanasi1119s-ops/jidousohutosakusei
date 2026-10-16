import './style.css'
import { calcInvoice, lineAmount, validateInvoice } from './calc'
import {
  MAX_LINES,
  emptyInvoice,
  emptyLine,
  newId,
  nextNumber,
  normalizeRegistrationNumber,
  parseBackupText,
  parseNumber,
  type Invoice,
  type Line,
  type Rounding,
  type TaxRate,
} from './model'
import { backupBlob, loadData, loadDraft, mergeInvoices, saveData, saveDraft, type StoredData } from './storage'
import { backupFileName, buildInvoicesCsvBlob, csvFileName, safeFileStem } from './csv'
import { esc, renderInvoiceHtml, yen } from './preview'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const data: StoredData = loadData()
let invoice: Invoice = loadDraft() ?? emptyInvoice()

app.innerHTML = `
  <div class="screen-only">
    <h1>請求書メーカー</h1>
    <p class="subtitle">インボイス（適格請求書）の記載事項に対応した請求書を作成し、PDFとして保存できます。</p>
    <div>
      <span class="badge">登録不要</span>
      <span class="badge">入力データは外部送信されません</span>
      <span class="badge">オフラインでも利用可能</span>
    </div>

    <details class="card" id="issuer-card">
      <summary>発行者情報（あなたの情報）</summary>
      <div class="grid">
        <div class="field"><label for="i-name">氏名・屋号・会社名</label><input id="i-name" maxlength="200" autocomplete="off" /></div>
        <div class="field"><label for="i-reg">登録番号（T+13桁、免税事業者は空欄）</label><input id="i-reg" maxlength="30" placeholder="T1234567890123" autocomplete="off" /></div>
        <div class="field wide"><label for="i-address">住所</label><textarea id="i-address" rows="2"></textarea></div>
        <div class="field"><label for="i-tel">電話番号</label><input id="i-tel" maxlength="50" autocomplete="off" /></div>
        <div class="field"><label for="i-email">メールアドレス</label><input id="i-email" maxlength="200" autocomplete="off" /></div>
        <div class="field wide"><label for="i-bank">振込先（銀行名・支店・口座種別・口座番号・名義）</label><textarea id="i-bank" rows="3"></textarea></div>
      </div>
    </details>

    <section class="card" aria-labelledby="edit-title">
      <h2 id="edit-title">請求書の内容</h2>
      <div class="grid">
        <div class="field"><label for="f-number">請求書番号</label><input id="f-number" maxlength="60" autocomplete="off" /></div>
        <div class="field"><label for="f-client">請求先（御中は自動で付きます）</label><input id="f-client" maxlength="200" autocomplete="off" /></div>
        <div class="field"><label for="f-issue">発行日</label><input id="f-issue" type="date" /></div>
        <div class="field"><label for="f-due">支払期限</label><input id="f-due" type="date" /></div>
        <div class="field wide"><label for="f-subject">件名（任意）</label><input id="f-subject" maxlength="200" autocomplete="off" /></div>
        <div class="field">
          <label for="f-mode">金額の入力方式</label>
          <select id="f-mode"><option value="exclusive">税抜で入力</option><option value="inclusive">税込で入力</option></select>
        </div>
        <div class="field">
          <label for="f-rounding">消費税の端数処理</label>
          <select id="f-rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select>
        </div>
      </div>

      <h3>明細</h3>
      <div class="table-wrap">
        <table class="lines-edit">
          <thead><tr><th>品名</th><th>数量</th><th>単価（円）</th><th>税率</th><th>金額</th><th></th></tr></thead>
          <tbody id="lines-body"></tbody>
        </table>
      </div>
      <button type="button" class="secondary" id="add-line">明細を追加</button>

      <div class="field check">
        <label><input type="checkbox" id="f-withholding" /> 源泉徴収税額を差し引く（報酬・料金等、税抜額に対して10.21%／100万円超の部分は20.42%）</label>
      </div>
      <div class="field wide"><label for="f-notes">備考（任意）</label><textarea id="f-notes" rows="2"></textarea></div>

      <div class="errors" id="errors" role="alert"></div>
      <div class="actions">
        <button type="button" id="btn-save">保存</button>
        <button type="button" id="btn-print">PDFで保存・印刷</button>
        <button type="button" class="secondary" id="btn-new">新しい請求書</button>
      </div>
      <p class="hint" id="status" role="status"></p>
    </section>

    <section class="card" aria-labelledby="saved-title">
      <h2 id="saved-title">保存済みの請求書</h2>
      <p id="saved-empty" class="hint">まだ保存された請求書はありません。</p>
      <ul id="saved-list" class="saved-list"></ul>
      <div class="actions">
        <button type="button" class="secondary" id="btn-csv">一覧をCSVでダウンロード</button>
        <button type="button" class="secondary" id="btn-export">バックアップ(JSON)</button>
        <button type="button" class="secondary" id="btn-import">バックアップを読み込む</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      </div>
      <p class="hint">データはこのブラウザの中にだけ保存されます。ブラウザのデータを消去すると失われるため、定期的にバックアップ(JSON)を保存してください。</p>
    </section>

    <section class="card" aria-labelledby="preview-title">
      <h2 id="preview-title">プレビュー</h2>
      <div id="preview" class="invoice-sheet"></div>
    </section>

    <footer class="disclaimer">
      <p>本ツールは請求書作成の補助を目的としたもので、税務・法律上の助言ではありません。適格請求書の記載要件や源泉徴収の取扱いは、必ず国税庁の最新情報または税理士にご確認ください。
      消費税額は「1枚の請求書につき、税率ごとに1回」端数処理して計算します（国税庁 消費税の軽減税率制度に関するQ&amp;A 問57）。</p>
      <p>© 2026 請求書メーカー / <a href="#" id="link-privacy">プライバシーについて</a></p>
      <p id="privacy-text" class="hidden">入力した内容はお使いのブラウザの内部（localStorage）にのみ保存され、外部のサーバーには一切送信されません。アクセス解析・広告・外部フォントは使用していません。</p>
    </footer>
  </div>
  <div id="print-area" class="print-only"></div>
`

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

const el = {
  iName: $<HTMLInputElement>('i-name'),
  iReg: $<HTMLInputElement>('i-reg'),
  iAddress: $<HTMLTextAreaElement>('i-address'),
  iTel: $<HTMLInputElement>('i-tel'),
  iEmail: $<HTMLInputElement>('i-email'),
  iBank: $<HTMLTextAreaElement>('i-bank'),
  number: $<HTMLInputElement>('f-number'),
  client: $<HTMLInputElement>('f-client'),
  issue: $<HTMLInputElement>('f-issue'),
  due: $<HTMLInputElement>('f-due'),
  subject: $<HTMLInputElement>('f-subject'),
  mode: $<HTMLSelectElement>('f-mode'),
  rounding: $<HTMLSelectElement>('f-rounding'),
  withholding: $<HTMLInputElement>('f-withholding'),
  notes: $<HTMLTextAreaElement>('f-notes'),
  linesBody: $<HTMLTableSectionElement>('lines-body'),
  errors: $<HTMLDivElement>('errors'),
  status: $<HTMLParagraphElement>('status'),
  preview: $<HTMLDivElement>('preview'),
  printArea: $<HTMLDivElement>('print-area'),
  savedList: $<HTMLUListElement>('saved-list'),
  savedEmpty: $<HTMLParagraphElement>('saved-empty'),
  importFile: $<HTMLInputElement>('import-file'),
}

function setStatus(msg: string): void {
  el.status.textContent = msg
}

/** 計算用に、数値が未入力・不正な明細を0として扱う。 */
function calcSafe(inv: Invoice): Invoice {
  return {
    ...inv,
    lines: inv.lines.map((l) => ({
      ...l,
      quantity: Number.isFinite(l.quantity) ? l.quantity : 0,
      unitPrice: Number.isFinite(l.unitPrice) ? l.unitPrice : 0,
    })),
  }
}

function persistIssuer(): void {
  data.issuer = {
    name: el.iName.value,
    registrationNumber: normalizeRegistrationNumber(el.iReg.value),
    address: el.iAddress.value,
    tel: el.iTel.value,
    email: el.iEmail.value,
    bank: el.iBank.value,
  }
  saveData(data)
}

function renderPreview(): void {
  const safe = calcSafe(invoice)
  const html = renderInvoiceHtml(safe, data.issuer)
  el.preview.innerHTML = html
  el.printArea.innerHTML = `<div class="invoice-sheet">${html}</div>`
  el.linesBody.querySelectorAll<HTMLElement>('[data-amount]').forEach((cell, i) => {
    const l = safe.lines[i]
    if (l) cell.textContent = yen(lineAmount(l, safe.rounding))
  })
}

function refresh(): void {
  renderPreview()
  saveDraft(invoice)
}

function buildLineRow(line: Line, index: number): HTMLTableRowElement {
  const tr = document.createElement('tr')
  const mk = (html: string): HTMLTableCellElement => {
    const td = document.createElement('td')
    td.innerHTML = html
    return td
  }
  const n = index + 1
  const tdDesc = mk(`<input data-k="description" maxlength="300" aria-label="明細${n}の品名" autocomplete="off" />`)
  const tdQty = mk(`<input data-k="quantity" inputmode="decimal" aria-label="明細${n}の数量" autocomplete="off" />`)
  const tdPrice = mk(`<input data-k="unitPrice" inputmode="decimal" aria-label="明細${n}の単価" autocomplete="off" />`)
  const tdRate = mk(
    `<select data-k="taxRate" aria-label="明細${n}の税率"><option value="10">10%</option><option value="8">8%（軽減）</option><option value="0">非課税</option></select>`,
  )
  const tdAmount = mk(`<span data-amount></span>`)
  tdAmount.className = 'num'
  const tdDel = mk(`<button type="button" class="secondary small" data-del aria-label="明細${n}を削除">削除</button>`)
  tr.append(tdDesc, tdQty, tdPrice, tdRate, tdAmount, tdDel)

  const q = <T extends HTMLElement>(k: string) => tr.querySelector<T>(`[data-k="${k}"]`)!
  const desc = q<HTMLInputElement>('description')
  const qty = q<HTMLInputElement>('quantity')
  const price = q<HTMLInputElement>('unitPrice')
  const rate = q<HTMLSelectElement>('taxRate')
  desc.value = line.description
  qty.value = Number.isNaN(line.quantity) ? '' : String(line.quantity)
  price.value = Number.isNaN(line.unitPrice) ? '' : String(line.unitPrice)
  rate.value = String(line.taxRate)

  desc.addEventListener('input', () => {
    line.description = desc.value
    refresh()
  })
  qty.addEventListener('input', () => {
    line.quantity = parseNumber(qty.value)
    refresh()
  })
  price.addEventListener('input', () => {
    line.unitPrice = parseNumber(price.value)
    refresh()
  })
  rate.addEventListener('change', () => {
    line.taxRate = Number(rate.value) as TaxRate
    refresh()
  })
  tr.querySelector('[data-del]')!.addEventListener('click', () => {
    if (invoice.lines.length <= 1) {
      invoice.lines[0] = emptyLine()
    } else {
      invoice.lines.splice(invoice.lines.indexOf(line), 1)
    }
    renderLines()
    refresh()
  })
  return tr
}

function renderLines(): void {
  el.linesBody.replaceChildren(...invoice.lines.map((l, i) => buildLineRow(l, i)))
}

function fillIssuerForm(): void {
  el.iName.value = data.issuer.name
  el.iReg.value = data.issuer.registrationNumber
  el.iAddress.value = data.issuer.address
  el.iTel.value = data.issuer.tel
  el.iEmail.value = data.issuer.email
  el.iBank.value = data.issuer.bank
}

function fillInvoiceForm(): void {
  el.number.value = invoice.number
  el.client.value = invoice.clientName
  el.issue.value = invoice.issueDate
  el.due.value = invoice.dueDate
  el.subject.value = invoice.subject
  el.mode.value = invoice.priceMode
  el.rounding.value = invoice.rounding
  el.withholding.checked = invoice.withholding
  el.notes.value = invoice.notes
  renderLines()
  refresh()
}

function renderSaved(): void {
  el.savedEmpty.classList.toggle('hidden', data.invoices.length > 0)
  el.savedList.replaceChildren(
    ...data.invoices.map((inv) => {
      const li = document.createElement('li')
      const t = calcInvoice(calcSafe(inv))
      const label = document.createElement('span')
      label.className = 'saved-label'
      label.innerHTML = `<strong>${esc(inv.number)}</strong> ${esc(inv.clientName)} ${yen(t.payable)} <small>${esc(inv.issueDate)}</small>`
      const open = button('開く', 'secondary small', () => {
        invoice = JSON.parse(JSON.stringify(inv)) as Invoice
        fillInvoiceForm()
        setStatus(`請求書 ${inv.number} を開きました。`)
      })
      const dup = button('複製', 'secondary small', () => {
        invoice = { ...(JSON.parse(JSON.stringify(inv)) as Invoice), id: newId(), number: nextNumber(inv.number) }
        fillInvoiceForm()
        setStatus('複製しました。請求書番号と日付を確認してください。')
      })
      const del = button('削除', 'secondary small', () => {
        if (!window.confirm(`請求書 ${inv.number} を削除しますか？`)) return
        data.invoices = data.invoices.filter((x) => x.id !== inv.id)
        saveData(data)
        renderSaved()
      })
      li.append(label, open, dup, del)
      return li
    }),
  )
}

function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = cls
  b.textContent = text
  b.addEventListener('click', onClick)
  return b
}

function currentErrors(): string[] {
  return validateInvoice(invoice, data.issuer.registrationNumber)
}

function showErrors(errs: string[]): boolean {
  el.errors.innerHTML = errs.map((e) => `<div>${esc(e)}</div>`).join('')
  return errs.length === 0
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- イベント配線 ----
for (const input of [el.iName, el.iReg, el.iAddress, el.iTel, el.iEmail, el.iBank]) {
  input.addEventListener('input', () => {
    persistIssuer()
    refresh()
  })
}
const bind = <K extends keyof Invoice>(input: HTMLInputElement | HTMLTextAreaElement, key: K): void => {
  input.addEventListener('input', () => {
    ;(invoice[key] as string) = input.value
    refresh()
  })
}
bind(el.number, 'number')
bind(el.client, 'clientName')
bind(el.issue, 'issueDate')
bind(el.due, 'dueDate')
bind(el.subject, 'subject')
bind(el.notes, 'notes')
el.mode.addEventListener('change', () => {
  invoice.priceMode = el.mode.value === 'inclusive' ? 'inclusive' : 'exclusive'
  refresh()
})
el.rounding.addEventListener('change', () => {
  invoice.rounding = el.rounding.value as Rounding
  refresh()
})
el.withholding.addEventListener('change', () => {
  invoice.withholding = el.withholding.checked
  refresh()
})

$('add-line').addEventListener('click', () => {
  if (invoice.lines.length >= MAX_LINES) {
    showErrors([`明細は${MAX_LINES}行までです。`])
    return
  }
  invoice.lines.push(emptyLine())
  renderLines()
  refresh()
})

$('btn-save').addEventListener('click', () => {
  if (!showErrors(currentErrors())) return
  const copy = JSON.parse(JSON.stringify(calcSafe(invoice))) as Invoice
  const idx = data.invoices.findIndex((x) => x.id === copy.id)
  if (idx >= 0) data.invoices[idx] = copy
  else data.invoices.unshift(copy)
  if (saveData(data)) setStatus('保存しました。')
  else showErrors(['ブラウザに保存できませんでした。バックアップ(JSON)を保存してください。'])
  renderSaved()
})

$('btn-new').addEventListener('click', () => {
  const prev = invoice
  invoice = emptyInvoice()
  invoice.number = nextNumber(prev.number)
  invoice.priceMode = prev.priceMode
  invoice.rounding = prev.rounding
  showErrors([])
  fillInvoiceForm()
  setStatus('新しい請求書を作成しました。')
})

$('btn-print').addEventListener('click', () => {
  if (!showErrors(currentErrors())) return
  renderPreview()
  const prevTitle = document.title
  document.title = safeFileStem(invoice.number)
  const restore = (): void => {
    document.title = prevTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
})

$('btn-csv').addEventListener('click', () => {
  if (data.invoices.length === 0) {
    showErrors(['CSVにする保存済みの請求書がありません。先に「保存」してください。'])
    return
  }
  showErrors([])
  download(buildInvoicesCsvBlob(data.invoices), csvFileName())
})

$('btn-export').addEventListener('click', () => {
  persistIssuer()
  download(backupBlob(data), backupFileName())
})

$('btn-import').addEventListener('click', () => el.importFile.click())
el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files?.[0]
  if (!file) return
  try {
    if (file.size > 5_000_000) throw new Error('ファイルが大きすぎます（5MBまで）。')
    const backup = parseBackupText(await file.text())
    data.invoices = mergeInvoices(data.invoices, backup.invoices)
    if (backup.issuer.name || backup.issuer.registrationNumber) data.issuer = backup.issuer
    saveData(data)
    fillIssuerForm()
    renderSaved()
    refresh()
    showErrors([])
    setStatus(`${backup.invoices.length}件の請求書を読み込みました。`)
  } catch (e) {
    showErrors([e instanceof Error ? e.message : '読み込みに失敗しました。'])
  } finally {
    el.importFile.value = ''
  }
})

$('link-privacy').addEventListener('click', (ev) => {
  ev.preventDefault()
  $('privacy-text').classList.toggle('hidden')
})

fillIssuerForm()
fillInvoiceForm()
renderSaved()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 未対応・登録失敗でも通常機能に影響しない
    })
  })
}
