import './style.css'
import { computeEntry, computeTotals, parseAmount, validateEntry, type Entry } from './calc'
import { AS_OF, CATEGORY_LABELS, SOURCE_NOTE, type Category } from './rules'
import { entriesToJsonBlob, loadEntries, parseEntriesFromJsonText, saveEntries } from './storage'
import { buildCsvBlob, csvDownloadFileName } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const categoryOptions = (Object.keys(CATEGORY_LABELS) as Category[])
  .map((k) => `<option value="${k}">${CATEGORY_LABELS[k]}</option>`)
  .join('')

app.innerHTML = `
  <h1>源泉徴収税額かんたん計算</h1>
  <p class="subtitle">原稿料・デザイン料・士業報酬などを支払うときの源泉徴収税額と支払額を計算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="entry-form" novalidate>
    <div class="field">
      <label for="label">項目名（任意）</label>
      <input type="text" id="label" name="label" maxlength="60" autocomplete="off" />
    </div>
    <div class="field">
      <label for="category">報酬の区分</label>
      <select id="category" name="category">${categoryOptions}</select>
    </div>
    <div class="field">
      <label for="amount">報酬額（消費税抜き・円）</label>
      <input type="text" id="amount" name="amount" inputmode="numeric" autocomplete="off" />
    </div>
    <div class="field">
      <label for="taxRate">消費税率</label>
      <select id="taxRate" name="taxRate">
        <option value="10">10%</option>
        <option value="8">8%（軽減税率）</option>
        <option value="0">0%（消費税なし）</option>
      </select>
    </div>
    <div class="field check">
      <input type="checkbox" id="taxSeparated" name="taxSeparated" checked />
      <label for="taxSeparated">請求書等で報酬額と消費税額が明確に区分されている（区分されていれば税抜額が源泉徴収の対象）</label>
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit" id="add">明細に追加して計算</button>
    </div>
  </form>
  <div class="summary" id="summary">
    <h2>計算結果</h2>
    <p id="empty">明細がありません。上のフォームから追加してください。</p>
    <div class="table-wrap">
      <table id="result-table" class="hidden">
        <thead>
          <tr>
            <th>項目</th>
            <th class="num">請求額(税込)</th>
            <th class="num">源泉徴収税額</th>
            <th class="num">支払額</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="result-body"></tbody>
      </table>
    </div>
    <p class="totals" id="totals"></p>
    <div class="actions">
      <button type="button" class="secondary" id="export-json">明細をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">明細をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
      <button type="button" class="secondary" id="clear">全て削除</button>
    </div>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な源泉徴収税額の試算を簡易に行うものであり、税務上の助言に代わるものではありません。
    ホステス等の報酬、芸能人の報酬、司法書士等の報酬、非居住者への支払い、源泉徴収の要否そのものの判断などには対応していません。
    ${SOURCE_NOTE}
    重要な判断の前には、国税庁の最新の公表情報または税理士などの専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const form = $<HTMLFormElement>('entry-form')
const errorsEl = $<HTMLDivElement>('errors')
const emptyEl = $<HTMLParagraphElement>('empty')
const table = $<HTMLTableElement>('result-table')
const body = $<HTMLTableSectionElement>('result-body')
const totalsEl = $<HTMLParagraphElement>('totals')
const importFile = $<HTMLInputElement>('import-file')

let entries: Entry[] = loadEntries()

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP') + '円'
}

function render(): void {
  const results = entries.map(computeEntry)
  const totals = computeTotals(results)
  emptyEl.style.display = results.length === 0 ? 'block' : 'none'
  table.classList.toggle('hidden', results.length === 0)
  body.innerHTML = results
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.entry.label || '(無題)')}<br><small>${CATEGORY_LABELS[r.entry.category]} / 報酬額 ${yen(r.entry.amountYen)} / 消費税 ${yen(r.consumptionTaxYen)}</small></td>
        <td class="num">${yen(r.billedYen)}</td>
        <td class="num">${yen(r.withholdingYen)}</td>
        <td class="num">${yen(r.paymentYen)}</td>
        <td><button type="button" class="danger" data-id="${r.entry.id}">削除</button></td>
      </tr>`,
    )
    .join('')
  totalsEl.textContent =
    results.length === 0
      ? ''
      : `合計: 請求額 ${yen(totals.billedYen)} / 源泉徴収税額 ${yen(totals.withholdingYen)} / 支払額 ${yen(totals.paymentYen)}`
  saveEntries(entries)
}

function nextId(): number {
  return entries.reduce((m, e) => Math.max(m, e.id), 0) + 1
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(form)
  const amount = parseAmount(String(data.get('amount') ?? ''))
  if (amount === null) {
    errorsEl.textContent = '報酬額は数字（全角も可）で入力してください。'
    return
  }
  const draft = {
    label: String(data.get('label') ?? '').trim(),
    category: String(data.get('category')) as Category,
    amountYen: amount,
    taxRatePercent: Number(data.get('taxRate')),
    taxSeparated: data.get('taxSeparated') === 'on',
  }
  const errors = validateEntry(draft)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) return
  entries = [...entries, { id: nextId(), ...draft }]
  ;($('amount') as HTMLInputElement).value = ''
  ;($('label') as HTMLInputElement).value = ''
  render()
})

body.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button[data-id]') as HTMLButtonElement | null
  if (!btn) return
  entries = entries.filter((x) => x.id !== Number(btn.dataset.id))
  render()
})

$('clear').addEventListener('click', () => {
  entries = []
  render()
})

$('export-json').addEventListener('click', () => download(entriesToJsonBlob(entries), 'withholding-tax-entries.json'))
$('import-json').addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    entries = parseEntriesFromJsonText(await file.text())
    errorsEl.textContent = ''
    render()
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})

$('export-csv').addEventListener('click', () => {
  if (entries.length === 0) {
    errorsEl.textContent = '先に明細を追加してください。'
    return
  }
  const results = entries.map(computeEntry)
  download(buildCsvBlob(results, computeTotals(results)), csvDownloadFileName())
})

render()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
